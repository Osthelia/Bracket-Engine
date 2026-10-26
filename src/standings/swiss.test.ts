/**
 * GC-Stats — swiss.test module
 *
 * Tests createSwissStandings' ranking and tiebreaker chain.
 *
 * @copyright Copyright (c) 2026 Osthelia — Bracket-Engine
 * @license   https://github.com/Osthelia/Bracket-Engine/blob/main/LICENSE.md MIT
 * @link      https://github.com/Osthelia/Bracket-Engine
 */

import { describe, expect, it } from "vitest";
import { createSwissStandings } from "./swiss";
import type { StandingsEntry } from "./types";

describe("createSwissStandings", () => {
  it("ranks by wins first, then buchholz, then round_diff, then seed", () => {
    const calc = createSwissStandings({ tiebreakers: ["buchholz", "round_diff", "seed"] });
    const entries: StandingsEntry[] = [
      { id: "a", seed: 1, wins: 3, losses: 1, buchholz: 500, roundDiff: 2 },
      { id: "b", seed: 2, wins: 3, losses: 1, buchholz: 700, roundDiff: 1 },
      { id: "c", seed: 3, wins: 2, losses: 2, buchholz: 900, roundDiff: 5 },
    ];
    const result = calc.recompute(entries);
    expect(result.map((r) => r.id)).toEqual(["b", "a", "c"]);
    expect(result.map((r) => r.rank)).toEqual([1, 2, 3]);
  });

  it("falls through to seed when wins and buchholz and round_diff all tie", () => {
    const calc = createSwissStandings({ tiebreakers: ["buchholz", "round_diff", "seed"] });
    const entries: StandingsEntry[] = [
      { id: "a", seed: 5, wins: 2, losses: 1, buchholz: 400, roundDiff: 0 },
      { id: "b", seed: 1, wins: 2, losses: 1, buchholz: 400, roundDiff: 0 },
    ];
    const result = calc.recompute(entries);
    expect(result.map((r) => r.id)).toEqual(["b", "a"]);
  });

  it("uses map_diff when configured", () => {
    const calc = createSwissStandings({ tiebreakers: ["map_diff", "buchholz", "seed"] });
    const entries: StandingsEntry[] = [
      { id: "a", seed: 1, wins: 2, losses: 1, buchholz: 900, roundDiff: 0, mapDiff: 0 },
      { id: "b", seed: 2, wins: 2, losses: 1, buchholz: 100, roundDiff: 0, mapDiff: 2 },
    ];
    expect(calc.recompute(entries).map((r) => r.id)).toEqual(["b", "a"]);
  });

  it("uses points before buchholz when configured first", () => {
    const calc = createSwissStandings({ tiebreakers: ["points", "buchholz", "seed"] });
    const entries: StandingsEntry[] = [
      { id: "a", seed: 1, wins: 2, losses: 1, buchholz: 900, roundDiff: 0, points: 10 },
      { id: "b", seed: 2, wins: 2, losses: 1, buchholz: 100, roundDiff: 0, points: 15 },
    ];
    const result = calc.recompute(entries);
    expect(result.map((r) => r.id)).toEqual(["b", "a"]);
  });

  it("treats a missing points field as 0", () => {
    const calc = createSwissStandings({ tiebreakers: ["points", "seed"] });
    const entries: StandingsEntry[] = [
      { id: "a", seed: 1, wins: 1, losses: 0, buchholz: 0, roundDiff: 0 },
      { id: "b", seed: 2, wins: 1, losses: 0, buchholz: 0, roundDiff: 0, points: 5 },
    ];
    const result = calc.recompute(entries);
    expect(result.map((r) => r.id)).toEqual(["b", "a"]);
  });
});
