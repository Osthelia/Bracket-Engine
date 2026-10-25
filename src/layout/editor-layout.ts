// Grid layout of the editor: one lane per container, one column per round, one row per match.
// A match keeps the row it was given (displayOrder), the others fill the free rows.

export interface EditorLayoutMatchInput {
  id: string;
  containerId: string;
  round: number;
  displayOrder?: number | null;
}

export interface EditorLayoutOptions {
  columnWidth: number;
  rowHeight: number;
  laneGap: number;
  // Space above row 0 for the round headers
  headerHeight: number;
}

export interface EditorLayoutResult {
  positions: Map<string, { x: number; y: number }>;
  // Top of each lane, by container id
  laneOffsetY: Map<string, number>;
  // Rounds present in each lane, ascending
  roundsByContainer: Map<string, number[]>;
  totalHeight: number;
}

export function layoutEditorGrid(matches: EditorLayoutMatchInput[], containerOrder: string[], opts: EditorLayoutOptions): EditorLayoutResult {
  const { columnWidth, rowHeight, laneGap, headerHeight } = opts;
  const byContainer = new Map<string, EditorLayoutMatchInput[]>();
  for (const m of matches) byContainer.set(m.containerId, [...(byContainer.get(m.containerId) ?? []), m]);

  const positions = new Map<string, { x: number; y: number }>();
  const laneOffsetY = new Map<string, number>();
  const roundsByContainer = new Map<string, number[]>();

  let cumulative = 0;
  for (const containerId of containerOrder) {
    laneOffsetY.set(containerId, cumulative);
    const byRound = new Map<number, EditorLayoutMatchInput[]>();
    for (const m of byContainer.get(containerId) ?? []) byRound.set(m.round, [...(byRound.get(m.round) ?? []), m]);
    const rounds = [...byRound.keys()].sort((a, b) => a - b);
    roundsByContainer.set(containerId, rounds);

    let maxRows = 0;
    for (const round of rounds) {
      const roundMatches = byRound.get(round)!;
      const rowOf = new Map<string, number>();
      const used = new Set<number>();
      for (const m of roundMatches) {
        if (m.displayOrder !== undefined && m.displayOrder !== null) {
          rowOf.set(m.id, m.displayOrder);
          used.add(m.displayOrder);
        }
      }
      let next = 0;
      const auto = roundMatches.filter((m) => !rowOf.has(m.id)).sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
      for (const m of auto) {
        while (used.has(next)) next++;
        rowOf.set(m.id, next);
        used.add(next);
      }
      for (const m of roundMatches) {
        const row = rowOf.get(m.id)!;
        positions.set(m.id, { x: (round - 1) * columnWidth, y: cumulative + headerHeight + row * rowHeight });
        maxRows = Math.max(maxRows, row + 1);
      }
    }
    cumulative += headerHeight + Math.max(maxRows, 1) * rowHeight + laneGap;
  }

  return { positions, laneOffsetY, roundsByContainer, totalHeight: cumulative };
}

export function rowIndexFromY(y: number, containerId: string, layout: Pick<EditorLayoutResult, "laneOffsetY">, opts: EditorLayoutOptions): number {
  const relY = y - (layout.laneOffsetY.get(containerId) ?? 0) - opts.headerHeight;
  return Math.max(0, Math.round(relY / opts.rowHeight));
}

// Round (column) and row a dropped match falls on
export function snapToGrid(x: number, y: number, containerId: string, layout: Pick<EditorLayoutResult, "laneOffsetY">, opts: EditorLayoutOptions): { x: number; y: number; round: number } {
  const laneBaseY = layout.laneOffsetY.get(containerId) ?? 0;
  const round = Math.max(1, Math.round(x / opts.columnWidth) + 1);
  const row = rowIndexFromY(y, containerId, layout, opts);
  return { x: (round - 1) * opts.columnWidth, y: laneBaseY + opts.headerHeight + row * opts.rowHeight, round };
}
