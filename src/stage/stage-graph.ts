import { fail, ok, type CoreError, type Result } from "../core/result";

// Where a slot of a match gets its entrant. A slot fed by an edge has no source of its own.
export type SlotSource =
  | { type: "unset" }
  | { type: "bye" }
  // Seed number of the tournament, resolved when the container starts
  | { type: "seed"; seed: number }
  // An entrant chosen by hand
  | { type: "entrant"; entrantId: string }
  // Rank of a group of another container, resolved when that group ends
  | { type: "group_rank"; containerId: string; rank: number }
  // Winner or loser of a match of another stage, resolved when that match ends
  | { type: "match_outcome"; matchId: string; outcome: "winner" | "loser" };

export interface StageGraphMatch {
  // A real match id, or a client id ("new-3") for a match created in the editor
  id: string;
  containerId: string;
  round: number;
  displayOrder: number | null;
  // Free name typed by the organizer
  label: string | null;
  // Generated name kept from the template, translated when displayed
  labelKey?: string | null;
  labelParams?: Record<string, number> | null;
  bestOf: number;
  slotA: SlotSource;
  slotB: SlotSource;
}

export interface StageGraphEdge {
  fromMatchId: string;
  fromResult: "winner" | "loser";
  toMatchId: string;
  toSlot: "a" | "b";
}

export interface StageGraphInput {
  matches: StageGraphMatch[];
  edges: StageGraphEdge[];
}

export const MAX_LABEL_LENGTH = 60;
export const MAX_BEST_OF = 99;

const isCount = (n: unknown, min: number, max = Infinity) => typeof n === "number" && Number.isInteger(n) && n >= min && n <= max;

function checkSource(source: SlotSource, path: string): CoreError[] {
  switch (source.type) {
    case "unset":
    case "bye":
      return [];
    case "seed":
      return isCount(source.seed, 1) ? [] : [{ code: "bracket.seed.invalid", path }];
    case "entrant":
      return typeof source.entrantId === "string" && source.entrantId ? [] : [{ code: "bracket.entrant.invalid", path }];
    case "group_rank":
      return [
        ...(typeof source.containerId === "string" && source.containerId ? [] : [{ code: "bracket.groupRank.container", path }]),
        ...(isCount(source.rank, 1) ? [] : [{ code: "bracket.groupRank.rank", path }]),
      ];
    case "match_outcome":
      return [
        ...(typeof source.matchId === "string" && source.matchId ? [] : [{ code: "bracket.outcome.match", path }]),
        ...(source.outcome === "winner" || source.outcome === "loser" ? [] : [{ code: "bracket.outcome.invalid", path }]),
      ];
    default:
      return [{ code: "bracket.source.invalid", path }];
  }
}

// Pure structural checks of an edited stage, an unfed slot is valid (TBD).
// Paths are "matches.<id>.slotA" so the editor can mark the right match.
// Containers listed in sharedSeedContainers (round robin groups) reuse a seed in several matches.
export function validateStageGraph(input: StageGraphInput, opts: { sharedSeedContainers?: ReadonlySet<string> } = {}): Result<StageGraphInput> {
  const errors: CoreError[] = [];
  const ids = new Set<string>();

  for (const m of input.matches) {
    const base = `matches.${m.id}`;
    if (ids.has(m.id)) errors.push({ code: "bracket.match.duplicate", path: base });
    ids.add(m.id);
    if (!isCount(m.round, 1, 99)) errors.push({ code: "bracket.match.round.invalid", path: `${base}.round` });
    if (!isCount(m.bestOf, 1, MAX_BEST_OF)) errors.push({ code: "bracket.match.bestOf.invalid", path: `${base}.bestOf` });
    if (m.label !== null && (typeof m.label !== "string" || m.label.length > MAX_LABEL_LENGTH)) {
      errors.push({ code: "bracket.match.label.tooLong", path: `${base}.label`, params: { max: MAX_LABEL_LENGTH } });
    }
    errors.push(...checkSource(m.slotA, `${base}.slotA`), ...checkSource(m.slotB, `${base}.slotB`));
  }

  const fed = new Set<string>();
  for (const e of input.edges) {
    if (!ids.has(e.fromMatchId) || !ids.has(e.toMatchId)) {
      errors.push({ code: "bracket.edge.unknownMatch", path: `edges.${e.fromMatchId}.${e.toMatchId}` });
      continue;
    }
    if (e.fromResult !== "winner" && e.fromResult !== "loser") errors.push({ code: "bracket.edge.result.invalid", path: `edges.${e.fromMatchId}` });
    if (e.toSlot !== "a" && e.toSlot !== "b") {
      errors.push({ code: "bracket.edge.slot.invalid", path: `edges.${e.toMatchId}` });
      continue;
    }
    const key = `${e.toMatchId}:${e.toSlot}`;
    if (fed.has(key)) errors.push({ code: "bracket.graph.slotFedTwice", path: `matches.${e.toMatchId}.slot${e.toSlot.toUpperCase()}` });
    fed.add(key);
  }

  // A slot fed by an edge cannot also have a source of its own
  for (const m of input.matches) {
    for (const [slot, source] of [["a", m.slotA], ["b", m.slotB]] as const) {
      if (fed.has(`${m.id}:${slot}`) && source.type !== "unset") errors.push({ code: "bracket.graph.slotFedTwice", path: `matches.${m.id}.slot${slot.toUpperCase()}` });
    }
  }

  // In a container, one seed number and one group rank feed a single slot
  const seeds = new Set<string>();
  const ranks = new Set<string>();
  for (const m of input.matches) {
    if (opts.sharedSeedContainers?.has(m.containerId)) continue;
    for (const [slot, source] of [["A", m.slotA], ["B", m.slotB]] as const) {
      const path = `matches.${m.id}.slot${slot}`;
      if (source.type === "seed") {
        const key = `${m.containerId}:${source.seed}`;
        if (seeds.has(key)) errors.push({ code: "bracket.seed.duplicate", path, params: { seed: source.seed } });
        seeds.add(key);
      } else if (source.type === "group_rank") {
        const key = `${m.containerId}:${source.containerId}:${source.rank}`;
        if (ranks.has(key)) errors.push({ code: "bracket.groupRank.duplicate", path, params: { rank: source.rank } });
        ranks.add(key);
      }
    }
  }

  if (errors.length === 0 && hasCycle(input)) errors.push({ code: "bracket.graph.cycle", path: "edges" });
  return errors.length > 0 ? fail(...errors) : ok(input);
}

function hasCycle(input: StageGraphInput): boolean {
  const next = new Map<string, string[]>();
  for (const e of input.edges) next.set(e.fromMatchId, [...(next.get(e.fromMatchId) ?? []), e.toMatchId]);
  const state = new Map<string, 1 | 2>();
  const visit = (id: string): boolean => {
    if (state.get(id) === 2) return false;
    if (state.get(id) === 1) return true;
    state.set(id, 1);
    for (const n of next.get(id) ?? []) if (visit(n)) return true;
    state.set(id, 2);
    return false;
  };
  return input.matches.some((m) => visit(m.id));
}
