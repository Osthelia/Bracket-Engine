export interface BracketEntrantView {
  id: string;
  name: string;
  logoUrl?: string | null;
}

export interface BracketMatchView {
  id: string;
  containerId: string;
  round: number;
  displayOrder: number | null;
  label: string | null;
  labelKey: string | null;
  labelParams: Record<string, number> | null;
  status: "pending" | "ready" | "live" | "completed";
  entrantA: BracketEntrantView | null;
  entrantB: BracketEntrantView | null;
  scoreA: number | null;
  scoreB: number | null;
  winnerId: string | null;
}

export interface BracketEdgeView {
  fromMatchId: string;
  toMatchId: string;
  fromResult: "winner" | "loser";
  toSlot: "a" | "b";
}

// A winner or loser leaving the bracket for another container
export interface BracketQualifierView {
  sourceMatchId: string;
  outcome: "winner" | "loser";
  entrantName: string | null;
  destination: string;
}

export interface GroupStandingView {
  entrantId: string;
  name: string;
  rank: number;
  wins: number;
  losses: number;
  mapWins: number;
  mapLosses: number;
  roundDiff: number;
  points: number | null;
}

// Ranks of a group that advance, with where they go
export interface GroupQualificationView {
  rankFrom: number;
  rankTo: number;
  destination: string;
}

// A stage as visitors read it: sets hold other blocks, groups show their standings, brackets are drawn.
// Brackets linked by edges (upper and lower of a double elimination) share one block, one lane each.
export type StageNodeView =
  | { kind: "set"; id: string; name: string; children: StageNodeView[] }
  | { kind: "group"; id: string; name: string; standings: GroupStandingView[]; rules: GroupQualificationView[] }
  | { kind: "bracket"; id: string; name: string | null; containers: BracketContainerView[] };

export interface BracketContainerView {
  id: string;
  name: string;
  matches: BracketMatchView[];
  edges: BracketEdgeView[];
  qualifiers: BracketQualifierView[];
}
