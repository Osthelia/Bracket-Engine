import type { SlotSource } from "../stage/stage-graph";

// Every text the components show. Pass a partial object to translate, anything missing falls back to English.
export interface ViewerLabels {
  tbd: string;
  explore: string;
  exploreDone: string;
  zoomHint: string;
  zoomHintTouch: string;
  qualified: (team: string, destination: string) => string;
  qualifiedWinner: (destination: string) => string;
  qualifiedLoser: (destination: string) => string;
  // Name of a generated match from its key ("upperRound", { round: 2 })
  matchName: (key: string, params: Record<string, number>) => string;
}

export interface EditorLabels {
  round: (round: number) => string;
  invalid: string;
  deleteMatch: string;
  deleteLink: string;
  cancel: string;
  apply: string;
  lockedNotice: string;
  addMatch: { container: string; round: string; button: string; hint: string };
  fill: { button: string; description: string; target: string; groups: string; size: (size: number) => string };
  save: string;
  saved: string;
  valid: string;
  errorCount: (count: number) => string;
  deleteTitle: string;
  deleteConfirm: string;
  source: {
    fed: string;
    unset: string;
    bye: string;
    seedValue: (seed: number) => string;
    entrantMissing: string;
    groupRankValue: (group: string, rank: number) => string;
    winnerOf: (match: string) => string;
    loserOf: (match: string) => string;
    type: string;
    types: Record<SlotSource["type"], string>;
    seed: string;
    entrant: string;
    choose: string;
    group: string;
    rank: string;
    match: string;
    outcome: string;
    outcomeWinner: string;
    outcomeLoser: string;
    errors: { seed: string; entrant: string; group: string; rank: string; match: string };
  };
}

export interface BracketLabels {
  viewer: ViewerLabels;
  editor: EditorLabels;
}

export type DeepPartial<T> = T extends (...args: never[]) => unknown ? T : T extends object ? { [K in keyof T]?: DeepPartial<T[K]> | undefined } : T;

const MATCH_NAMES: Record<string, (p: Record<string, number>) => string> = {
  round: (p) => `Round ${p.round}`,
  final: () => "Final",
  upperRound: (p) => `Upper Round ${p.round}`,
  upperSemifinals: () => "Upper Semifinals",
  upperFinal: () => "Upper Final",
  middleRound: (p) => `Middle Round ${p.round}`,
  middleFinal: () => "Middle Final",
  lowerRound: (p) => `Lower Round ${p.round}`,
  lowerFinal: () => "Lower Final",
  grandFinal: () => "Grand Final",
  final1: () => "Final 1",
  final2: () => "Final 2",
  openerA: () => "Opener A",
  openerB: () => "Opener B",
  winnersMatch: () => "Winners Match",
  eliminationMatch: () => "Elimination Match",
  decider: () => "Decider",
};

export const defaultLabels: BracketLabels = {
  viewer: {
    tbd: "TBD",
    explore: "Explore the bracket",
    exploreDone: "Done",
    zoomHint: "scroll to zoom",
    zoomHintTouch: "Pinch to zoom",
    qualified: (team, destination) => `${team} qualified for ${destination}`,
    qualifiedWinner: (destination) => `The winner goes to ${destination}`,
    qualifiedLoser: (destination) => `The loser goes to ${destination}`,
    matchName: (key, params) => MATCH_NAMES[key]?.(params) ?? key,
  },
  editor: {
    round: (round) => `Round ${round}`,
    invalid: "Invalid",
    deleteMatch: "Delete the match",
    deleteLink: "Delete the link",
    cancel: "Cancel",
    apply: "Apply",
    lockedNotice: "This stage has started or you cannot edit it. The structure is read only.",
    addMatch: {
      container: "Bracket",
      round: "Round",
      button: "Add a match",
      hint: "A new match starts with two empty slots. Drag a node to move it, drag from a colored dot to link a winner or a loser.",
    },
    fill: {
      button: "Fill from groups",
      description: "Seed 1 takes the first place of the first group, seed 2 the first place of the next group, and so on, then the second places.",
      target: "Bracket to fill",
      groups: "Groups",
      size: (size) => `${size} ranks`,
    },
    save: "Save",
    saved: "Saved",
    valid: "The structure is valid.",
    errorCount: (count) => `${count} ${count === 1 ? "problem" : "problems"} to fix`,
    deleteTitle: "Delete this match?",
    deleteConfirm: "The match and its links are removed from the editor. Nothing changes until you save.",
    source: {
      fed: "Fed by a link",
      unset: "To be defined",
      bye: "Bye",
      seedValue: (seed) => `Seed ${seed}`,
      entrantMissing: "Unknown participant",
      groupRankValue: (group, rank) => `${group}, rank ${rank}`,
      winnerOf: (match) => `Winner of ${match}`,
      loserOf: (match) => `Loser of ${match}`,
      type: "Source",
      types: { unset: "To be defined", bye: "Bye", seed: "Tournament seed", entrant: "A participant", group_rank: "Rank of a group", match_outcome: "Result of a match" },
      seed: "Seed",
      entrant: "Participant",
      choose: "Choose",
      group: "Group",
      rank: "Rank",
      match: "Match",
      outcome: "Outcome",
      outcomeWinner: "Winner",
      outcomeLoser: "Loser",
      errors: {
        seed: "Enter a whole number, 1 or more.",
        entrant: "Choose a participant.",
        group: "Choose a group.",
        rank: "Enter a whole number, 1 or more.",
        match: "Choose a match.",
      },
    },
  },
};

function merge<T>(base: T, patch: DeepPartial<T> | undefined): T {
  if (!patch) return base;
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [key, value] of Object.entries(patch as Record<string, unknown>)) {
    if (value === undefined) continue;
    const current = out[key];
    out[key] = value && typeof value === "object" && current && typeof current === "object" ? merge(current, value as DeepPartial<typeof current>) : value;
  }
  return out as T;
}

export function resolveLabels(patch?: DeepPartial<BracketLabels>): BracketLabels {
  return merge<BracketLabels>(defaultLabels, patch);
}
