import type { CoreError } from "../core/result";

// Order in which the groups feed a bracket: every group first place, then every group second place...
// Seed n of the bracket takes the nth entry. The groups keep the order they are given in.
export function groupRankOrder(groups: readonly { id: string; size: number }[]): { containerId: string; rank: number }[] {
  const order: { containerId: string; rank: number }[] = [];
  const deepest = Math.max(0, ...groups.map((g) => g.size));
  for (let rank = 1; rank <= deepest; rank++) {
    for (const group of groups) if (group.size >= rank) order.push({ containerId: group.id, rank });
  }
  return order;
}

export const MAX_RNG_SEED = 2 ** 31 - 1;

export const newRngSeed = (): number => Math.floor(Math.random() * MAX_RNG_SEED) + 1;

// Same seed, same sequence: a draw can be replayed and contested
function createRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(items: readonly T[], rngSeed: number): T[] {
  const rng = createRng(rngSeed);
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

export interface QualifiedEntry {
  entrantId: string;
  // Seed given by the qualification rule, null when it comes without one
  seed: number | null;
  // Rank in the source group or placement, null for a match outcome
  rank: number | null;
}

export const byNullLast = (a: number | null, b: number | null) => (a === b ? 0 : a === null ? 1 : b === null ? -1 : a - b);

// Seed given by the qualification first, then the rank it came with. An entrant listed twice keeps its best entry.
export function qualificationOrder(entries: readonly QualifiedEntry[]): string[] {
  const best = new Map<string, QualifiedEntry>();
  for (const e of entries) {
    const known = best.get(e.entrantId);
    if (!known || byNullLast(e.seed, known.seed) < 0 || (e.seed === known.seed && byNullLast(e.rank, known.rank) < 0)) best.set(e.entrantId, e);
  }
  return [...best.values()].sort((a, b) => byNullLast(a.seed, b.seed) || byNullLast(a.rank, b.rank)).map((e) => e.entrantId);
}

export interface DistributionGroup {
  id: string;
  // Number of seed positions the group holds
  capacity: number;
}

export interface Placement {
  containerId: string;
  position: number;
  entrantId: string;
}

export const DISTRIBUTION_MODES = ["manual", "random_group", "random_position", "global", "group_seeding"] as const;
export type DistributionMode = (typeof DISTRIBUTION_MODES)[number];

// Group indexes in snake order (A B C C B A A B C ...), a full group is skipped
function snakeGroupOf(count: number, groups: readonly DistributionGroup[]): number[] {
  const filled = groups.map(() => 0);
  const out: number[] = [];
  for (let step = 0; out.length < count; step++) {
    const row = Math.floor(step / groups.length);
    const col = step % groups.length;
    const index = row % 2 === 0 ? col : groups.length - 1 - col;
    if (filled[index]! >= groups[index]!.capacity) {
      if (filled.every((n, i) => n >= groups[i]!.capacity)) break;
      continue;
    }
    filled[index]!++;
    out.push(index);
  }
  return out;
}

// Positions of a group follow the global order, entrants without a rank go last
function positionByOrder(entrantIds: readonly string[], order: readonly string[]): string[] {
  const rank = new Map(order.map((id, i) => [id, i]));
  return [...entrantIds].sort((a, b) => (rank.get(a) ?? Infinity) - (rank.get(b) ?? Infinity));
}

const toPlacements = (groups: readonly DistributionGroup[], members: string[][]): Placement[] =>
  groups.flatMap((g, i) => members[i]!.map((entrantId, p) => ({ containerId: g.id, position: p + 1, entrantId })));

// Capacity of every group together
export const totalCapacity = (groups: readonly DistributionGroup[]): number => groups.reduce((sum, g) => sum + g.capacity, 0);

// Spreads entrants (best first) over the groups. The caller checks there is room for everyone.
//  random_group: the group is drawn, the position follows the global order
//  random_position: the group follows the global order (snake), the position is drawn
//  global: both follow the global order
export function distribute(mode: "random_group" | "random_position" | "global", order: readonly string[], groups: readonly DistributionGroup[], rngSeed: number): Placement[] {
  if (groups.length === 0) return [];
  const members: string[][] = groups.map(() => []);

  if (mode === "random_group") {
    // Dealt like cards, groups end up balanced
    const dealt = snakeGroupOf(order.length, groups);
    shuffle(order, rngSeed).forEach((id, i) => {
      const g = dealt[i];
      if (g !== undefined) members[g]!.push(id);
    });
    return toPlacements(groups, members.map((m) => positionByOrder(m, order)));
  }

  snakeGroupOf(order.length, groups).forEach((g, i) => members[g]!.push(order[i]!));
  if (mode === "global") return toPlacements(groups, members);
  return toPlacements(groups, members.map((m, i) => shuffle(m, rngSeed + i + 1)));
}

// Each group lists its own entrants best first (seeding that goes straight into the group)
export function placeInGroups(lists: readonly { containerId: string; entrantIds: readonly string[] }[]): Placement[] {
  return lists.flatMap((l) => l.entrantIds.map((entrantId, p) => ({ containerId: l.containerId, position: p + 1, entrantId })));
}

// A position exists, is held once, and an entrant plays in one group of the set at most
export function validatePlacements(placements: readonly Placement[], groups: readonly DistributionGroup[], pool: ReadonlySet<string>): CoreError[] {
  const errors: CoreError[] = [];
  const capacity = new Map(groups.map((g) => [g.id, g.capacity]));
  const taken = new Set<string>();
  const placed = new Set<string>();
  placements.forEach((p, i) => {
    const path = `placements.${i}`;
    const max = capacity.get(p.containerId);
    if (max === undefined) return void errors.push({ code: "bracket.distribution.group.invalid", path });
    if (!Number.isInteger(p.position) || p.position < 1 || p.position > max) errors.push({ code: "bracket.distribution.position.invalid", path, params: { max } });
    if (!pool.has(p.entrantId)) errors.push({ code: "bracket.entrant.notFound", path });
    const spot = `${p.containerId}:${p.position}`;
    if (taken.has(spot)) errors.push({ code: "bracket.distribution.position.taken", path, params: { position: p.position } });
    taken.add(spot);
    if (placed.has(p.entrantId)) errors.push({ code: "bracket.distribution.entrant.twice", path });
    placed.add(p.entrantId);
  });
  return errors;
}
