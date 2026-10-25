import { describe, expect, it } from "vitest";
import { distribute, groupRankOrder, placeInGroups, qualificationOrder, shuffle, validatePlacements } from "./seeding";

describe("groupRankOrder", () => {
  it("lists every first place, then every second place", () => {
    expect(groupRankOrder([{ id: "A", size: 3 }, { id: "B", size: 3 }])).toEqual([
      { containerId: "A", rank: 1 }, { containerId: "B", rank: 1 },
      { containerId: "A", rank: 2 }, { containerId: "B", rank: 2 },
      { containerId: "A", rank: 3 }, { containerId: "B", rank: 3 },
    ]);
  });

  it("skips a rank a smaller group does not have", () => {
    expect(groupRankOrder([{ id: "A", size: 1 }, { id: "B", size: 2 }]).map((o) => `${o.containerId}${o.rank}`)).toEqual(["A1", "B1", "B2"]);
    expect(groupRankOrder([])).toEqual([]);
  });
});

const ids = (n: number) => Array.from({ length: n }, (_, i) => `e${i + 1}`);
const groups = [{ id: "A", capacity: 4 }, { id: "B", capacity: 4 }];
const of = (placements: ReturnType<typeof distribute>, containerId: string) => placements.filter((p) => p.containerId === containerId).sort((a, b) => a.position - b.position).map((p) => p.entrantId);

describe("shuffle", () => {
  it("replays the same draw for the same seed and keeps everyone", () => {
    expect(shuffle(ids(8), 42)).toEqual(shuffle(ids(8), 42));
    expect(shuffle(ids(8), 42)).not.toEqual(shuffle(ids(8), 43));
    expect([...shuffle(ids(8), 7)].sort()).toEqual(ids(8));
  });
});

describe("qualificationOrder", () => {
  it("orders by given seed, then rank, and keeps the best entry of a repeated entrant", () => {
    expect(
      qualificationOrder([
        { entrantId: "a", seed: null, rank: 2 },
        { entrantId: "b", seed: 2, rank: 1 },
        { entrantId: "c", seed: 1, rank: 5 },
        { entrantId: "d", seed: null, rank: 3 },
        { entrantId: "a", seed: null, rank: 1 },
      ]),
    ).toEqual(["c", "b", "a", "d"]);
  });
});

describe("distribute", () => {
  it("global: snake over the groups, positions follow the order", () => {
    const res = distribute("global", ids(8), groups, 1);
    expect(of(res, "A")).toEqual(["e1", "e4", "e5", "e8"]);
    expect(of(res, "B")).toEqual(["e2", "e3", "e6", "e7"]);
  });

  it("random_group: balanced groups, positions follow the global order, replayable", () => {
    const res = distribute("random_group", ids(8), groups, 9);
    expect(of(res, "A")).toHaveLength(4);
    const a = of(res, "A");
    expect([...a].sort()).toEqual(a);
    expect(distribute("random_group", ids(8), groups, 9)).toEqual(res);
  });

  it("random_position: groups follow the snake, positions are drawn inside the group", () => {
    const res = distribute("random_position", ids(8), groups, 3);
    expect([...of(res, "A")].sort()).toEqual(["e1", "e4", "e5", "e8"]);
    expect([...of(res, "B")].sort()).toEqual(["e2", "e3", "e6", "e7"]);
  });

  it("skips a full group and compacts positions when there are fewer entrants", () => {
    const small = [{ id: "A", capacity: 1 }, { id: "B", capacity: 3 }];
    const res = distribute("global", ids(4), small, 1);
    expect(of(res, "A")).toEqual(["e1"]);
    expect(of(res, "B")).toEqual(["e2", "e3", "e4"]);
    expect(distribute("global", ids(3), groups, 1).map((p) => p.position)).toEqual([1, 1, 2]);
  });
});

describe("placeInGroups and validatePlacements", () => {
  it("numbers each list from 1", () => {
    expect(placeInGroups([{ containerId: "A", entrantIds: ["x", "y"] }])).toEqual([
      { containerId: "A", position: 1, entrantId: "x" },
      { containerId: "A", position: 2, entrantId: "y" },
    ]);
  });

  it("reports an unknown group, a bad or taken position, a stranger and a repeated entrant", () => {
    const pool = new Set(["x", "y"]);
    const res = validatePlacements(
      [
        { containerId: "Z", position: 1, entrantId: "x" },
        { containerId: "A", position: 9, entrantId: "x" },
        { containerId: "A", position: 1, entrantId: "q" },
        { containerId: "A", position: 1, entrantId: "y" },
        { containerId: "B", position: 1, entrantId: "y" },
      ],
      groups,
      pool,
    );
    expect(res.map((e) => `${e.path}:${e.code}`)).toEqual([
      "placements.0:bracket.distribution.group.invalid",
      "placements.1:bracket.distribution.position.invalid",
      "placements.2:bracket.entrant.notFound",
      "placements.3:bracket.distribution.position.taken",
      "placements.4:bracket.distribution.entrant.twice",
    ]);
    expect(validatePlacements([{ containerId: "A", position: 1, entrantId: "x" }], groups, pool)).toEqual([]);
  });
});
