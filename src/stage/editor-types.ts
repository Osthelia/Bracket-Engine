import type { SlotSource, StageGraphEdge } from "./stage-graph";

export interface EditorContainer {
  id: string;
  name: string;
  containerType: "bracket" | "group";
}

export interface EditorMatch {
  id: string;
  containerId: string;
  round: number;
  displayOrder: number | null;
  label: string | null;
  labelKey: string | null;
  labelParams: Record<string, number> | null;
  bestOf: number;
  status: "pending" | "ready" | "live" | "completed";
  // A slot fed by an edge reports "unset", the edge list tells it is fed
  slotA: SlotSource;
  slotB: SlotSource;
}

// A container of an earlier stage whose ranks can seed this stage
export interface RankSource {
  id: string;
  name: string;
  stageName: string;
  // How many ranks the group produces, from its entrants
  size: number;
}

// A match of an earlier stage whose winner or loser can seed this stage
export interface OutcomeSource {
  id: string;
  label: string | null;
  labelKey: string | null;
  labelParams: Record<string, number> | null;
  round: number;
  containerName: string;
  stageName: string;
}

export interface StageEditorData {
  stage: { id: string; name: string; status: "pending" | "active" | "completed" };
  // True once a match was played, the structure can no longer be edited
  locked: boolean;
  containers: EditorContainer[];
  matches: EditorMatch[];
  edges: StageGraphEdge[];
  entrants: { id: string; name: string; seed: number | null }[];
  rankSources: RankSource[];
  outcomeSources: OutcomeSource[];
}
