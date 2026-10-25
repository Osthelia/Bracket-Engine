import type { EditorMatch, OutcomeSource, RankSource } from "../../stage/editor-types";
import type { SlotSource } from "../../stage/stage-graph";

// What a slot can be fed from, shown in the source picker
export interface EditorLookups {
  entrants: { id: string; name: string; seed: number | null }[];
  rankSources: RankSource[];
  outcomeSources: OutcomeSource[];
}

export type MatchNodeData = {
  containerId: string;
  containerName: string;
  round: number;
  label: string | null;
  labelKey: string | null;
  labelParams: Record<string, number> | null;
  bestOf: number;
  status: EditorMatch["status"];
  slotA: SlotSource;
  slotB: SlotSource;
  // A slot fed by a link has no source of its own
  fedA: boolean;
  fedB: boolean;
  invalid: boolean;
  readOnly: boolean;
  lookups: EditorLookups;
  onSetSlot: (slot: "a" | "b", source: SlotSource) => void;
  onDelete: () => void;
};

export type RoundHeaderData = { containerName: string; round: number };

export type DeletableEdgeData = { onDelete: () => void; readOnly: boolean };
