/**
 * GC-Stats — Round-robin standings calculator
 *
 * Ranks entries by wins, then a configurable tiebreaker chain (points,
 * map diff, round diff, head to head, seed).
 *
 * @copyright Copyright (c) 2026 Osthelia — Bracket-Engine
 * @license   https://github.com/Osthelia/Bracket-Engine/blob/main/LICENSE.md MIT
 * @link      https://github.com/Osthelia/Bracket-Engine
 */

import type { StandingsCalculator, StandingsEntry, RankedStandingsEntry } from "./types";
import { assignRanks } from "./types";

export type RoundRobinTiebreaker = "points" | "map_diff" | "round_diff" | "head_to_head" | "seed";

export interface RoundRobinStandingsConfig {
  tiebreakers: RoundRobinTiebreaker[];
}

/** Wins first, then the configured tiebreaker chain (round diff, then a
 *  single-opponent head-to-head lookup, then seed as a final stable break). */
export function createRoundRobinStandings(config: RoundRobinStandingsConfig): StandingsCalculator {
  return {
    recompute(entries: StandingsEntry[]): RankedStandingsEntry[] {
      const sorted = [...entries].sort((a, b) => compare(a, b, config.tiebreakers));
      return assignRanks(sorted, (a, b) => compare(a, b, config.tiebreakers) === 0);
    },
  };
}

function compare(a: StandingsEntry, b: StandingsEntry, tiebreakers: RoundRobinTiebreaker[]): number {
  if (a.wins !== b.wins) return b.wins - a.wins;
  for (const tb of tiebreakers) {
    if (tb === "points" && (a.points ?? 0) !== (b.points ?? 0)) return (b.points ?? 0) - (a.points ?? 0);
    if (tb === "map_diff" && (a.mapDiff ?? 0) !== (b.mapDiff ?? 0)) return (b.mapDiff ?? 0) - (a.mapDiff ?? 0);
    if (tb === "round_diff" && a.roundDiff !== b.roundDiff) return b.roundDiff - a.roundDiff;
    if (tb === "head_to_head") {
      // Pairwise only: on a 3+ way circular tie (A > B > C > A) the result is
      // arbitrary but deterministic (sort order dependent), not incorrect.
      const result = a.headToHead?.get(b.id);
      if (result === "win") return -1;
      if (result === "loss") return 1;
    }
    if (tb === "seed" && a.seed !== b.seed) return a.seed - b.seed;
  }
  return a.seed - b.seed;
}
