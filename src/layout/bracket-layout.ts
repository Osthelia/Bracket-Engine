// Pure bracket layout shared by the public viewer, the dashboard viewer and the editor.
// Works on plain match and edge data, no DB access.

export interface LayoutMatchInput {
  id: string;
  containerId: string;
  // Floors the column at round - 1, so a bye seeded straight into round 2 does not land in column 0
  round: number;
  // Manual row hint: sorts matches with no feeder, and is used as their literal row
  displayOrder?: number | null;
}

export interface LayoutEdgeInput {
  fromMatchId: string;
  toMatchId: string;
  fromResult: "winner" | "loser";
}

export interface BracketLayoutOptions {
  columnWidth: number;
  rowHeight: number;
  laneGap: number;
}

export interface BracketLayoutResult {
  positions: Map<string, { x: number; y: number }>;
  laneIndexByContainer: Map<string, number>;
  // Top y of each lane, useful to route a connector through the gap between two lanes
  laneOffsetY: Map<number, number>;
  totalHeight: number;
}

function compareByDisplayOrderThenId(a: LayoutMatchInput, b: LayoutMatchInput): number {
  const ad = a.displayOrder ?? null;
  const bd = b.displayOrder ?? null;
  if (ad !== null && bd !== null && ad !== bd) return ad - bd;
  if (ad !== null && bd === null) return -1;
  if (ad === null && bd !== null) return 1;
  return a.id.localeCompare(b.id, undefined, { numeric: true });
}

// Column: longest path from a source match.
// Lane: a container fed only by winner edges (a grand final) shares the lane of its source,
// a container fed by a loser edge (a lower bracket) gets its own lane.
// Row: a fed match is centered between its same lane feeders, the others fill free rows.
export function layoutBracket(
  matches: LayoutMatchInput[],
  edges: LayoutEdgeInput[],
  containerOrder: string[],
  opts: BracketLayoutOptions,
): BracketLayoutResult {
  const { columnWidth, rowHeight, laneGap } = opts;

  const matchContainer = new Map(matches.map((m) => [m.id, m.containerId]));
  const matchRound = new Map(matches.map((m) => [m.id, m.round]));
  const incoming = new Map<string, LayoutEdgeInput[]>();
  for (const e of edges) {
    const list = incoming.get(e.toMatchId) ?? [];
    list.push(e);
    incoming.set(e.toMatchId, list);
  }

  const column = new Map<string, number>();
  function computeColumn(id: string, guard: Set<string>): number {
    const cached = column.get(id);
    if (cached !== undefined) return cached;
    if (guard.has(id)) return 0;
    guard.add(id);
    const ins = incoming.get(id) ?? [];
    const topological = ins.length === 0 ? 0 : 1 + Math.max(...ins.map((e) => computeColumn(e.fromMatchId, guard)));
    const c = Math.max(topological, (matchRound.get(id) ?? 1) - 1);
    column.set(id, c);
    return c;
  }
  for (const m of matches) computeColumn(m.id, new Set());

  const containerIds = [...new Set(matches.map((m) => m.containerId))];
  const interInto = new Map<string, { edge: LayoutEdgeInput; fromContainer: string }[]>();
  for (const c of containerIds) interInto.set(c, []);
  for (const e of edges) {
    const fromC = matchContainer.get(e.fromMatchId);
    const toC = matchContainer.get(e.toMatchId);
    if (fromC && toC && fromC !== toC) interInto.get(toC)!.push({ edge: e, fromContainer: fromC });
  }
  const isRoot = (c: string) => interInto.get(c)!.length === 0;
  const hasLoserInterEdge = (c: string) => interInto.get(c)!.some((x) => x.edge.fromResult === "loser");

  // The anchor is the container whose lane is shared, the earliest source in containerOrder wins
  const laneAnchor = new Map<string, string>();
  function resolveAnchor(c: string): string {
    const cached = laneAnchor.get(c);
    if (cached) return cached;
    if (isRoot(c) || hasLoserInterEdge(c)) {
      laneAnchor.set(c, c);
      return c;
    }
    const sources = [...new Set(interInto.get(c)!.map((x) => x.fromContainer))];
    let best: string | null = null;
    let bestIndex = Infinity;
    for (const src of sources) {
      const anchor = resolveAnchor(src);
      const idx = containerOrder.indexOf(anchor);
      const effectiveIdx = idx === -1 ? Infinity : idx;
      if (effectiveIdx < bestIndex) {
        bestIndex = effectiveIdx;
        best = anchor;
      }
    }
    const resolved = best ?? c;
    laneAnchor.set(c, resolved);
    return resolved;
  }
  for (const c of containerIds) resolveAnchor(c);

  const distinctAnchors = [...new Set(containerIds.map((c) => laneAnchor.get(c)!))];
  distinctAnchors.sort((a, b) => containerOrder.indexOf(a) - containerOrder.indexOf(b));
  const laneIndexByAnchor = new Map(distinctAnchors.map((a, i) => [a, i]));
  const laneIndexByContainer = new Map(containerIds.map((c) => [c, laneIndexByAnchor.get(laneAnchor.get(c)!)!]));

  const rawY = new Map<string, number>();
  const matchesByLane = new Map<number, LayoutMatchInput[]>();
  for (const m of matches) {
    const lane = laneIndexByContainer.get(m.containerId)!;
    const list = matchesByLane.get(lane) ?? [];
    list.push(m);
    matchesByLane.set(lane, list);
  }

  const laneMaxY = new Map<number, number>();
  for (const [lane, laneMatches] of matchesByLane) {
    const byColumn = new Map<number, LayoutMatchInput[]>();
    for (const m of laneMatches) {
      const col = column.get(m.id)!;
      const list = byColumn.get(col) ?? [];
      list.push(m);
      byColumn.set(col, list);
    }

    for (const col of [...byColumn.keys()].sort((a, b) => a - b)) {
      const colMatches = byColumn.get(col)!.sort(compareByDisplayOrderThenId);

      // A match is fed when an earlier match of the same lane leads to it
      const rootMatches: LayoutMatchInput[] = [];
      const fedMatches: { m: LayoutMatchInput; feederYs: number[] }[] = [];
      for (const m of colMatches) {
        const feederYs = (incoming.get(m.id) ?? [])
          .filter((e) => laneIndexByContainer.get(matchContainer.get(e.fromMatchId)!) === lane)
          .map((e) => rawY.get(e.fromMatchId))
          .filter((y): y is number => y !== undefined);
        if (feederYs.length > 0) fedMatches.push({ m, feederYs });
        else rootMatches.push(m);
      }

      // An explicit displayOrder is a literal row, a gap can be intentional
      const usedRows = new Set<number>();
      for (const m of rootMatches) {
        if (m.displayOrder !== undefined && m.displayOrder !== null) usedRows.add(m.displayOrder);
      }
      let nextAutoRow = 0;
      for (const m of rootMatches) {
        let row: number;
        if (m.displayOrder !== undefined && m.displayOrder !== null) {
          row = m.displayOrder;
        } else {
          while (usedRows.has(nextAutoRow)) nextAutoRow++;
          row = nextAutoRow;
          usedRows.add(row);
        }
        rawY.set(m.id, row * rowHeight);
      }

      // Fed matches ignore displayOrder, they always follow their feeders
      for (const { m, feederYs } of fedMatches) {
        rawY.set(m.id, feederYs.reduce((a, b) => a + b, 0) / feederYs.length);
      }
    }
    laneMaxY.set(lane, Math.max(0, ...laneMatches.map((m) => rawY.get(m.id) ?? 0)));
  }

  const laneOffsetY = new Map<number, number>();
  let cumulative = 0;
  for (let i = 0; i < distinctAnchors.length; i++) {
    laneOffsetY.set(i, cumulative);
    cumulative += (laneMaxY.get(i) ?? 0) + rowHeight + laneGap;
  }

  const positions = new Map<string, { x: number; y: number }>();
  for (const m of matches) {
    const lane = laneIndexByContainer.get(m.containerId)!;
    positions.set(m.id, { x: column.get(m.id)! * columnWidth, y: (rawY.get(m.id) ?? 0) + (laneOffsetY.get(lane) ?? 0) });
  }

  return { positions, laneIndexByContainer, laneOffsetY, totalHeight: cumulative };
}
