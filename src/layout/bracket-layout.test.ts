import { describe, expect, it } from "vitest";
import { layoutBracket } from "./bracket-layout";

const opts = { columnWidth: 100, rowHeight: 10, laneGap: 5 };

describe("layoutBracket", () => {
  it("centers a fed match between its feeders", () => {
    const matches = [
      { id: "a", containerId: "u", round: 1 },
      { id: "b", containerId: "u", round: 1 },
      { id: "f", containerId: "u", round: 2 },
    ];
    const edges = [
      { fromMatchId: "a", toMatchId: "f", fromResult: "winner" as const },
      { fromMatchId: "b", toMatchId: "f", fromResult: "winner" as const },
    ];
    const { positions } = layoutBracket(matches, edges, ["u"], opts);
    expect(positions.get("a")).toEqual({ x: 0, y: 0 });
    expect(positions.get("b")).toEqual({ x: 0, y: 10 });
    expect(positions.get("f")).toEqual({ x: 100, y: 5 });
  });

  it("puts a loser fed container in its own lane and a winner fed one in the source lane", () => {
    const matches = [
      { id: "u1", containerId: "u", round: 1 },
      { id: "l1", containerId: "l", round: 1 },
      { id: "gf", containerId: "g", round: 1 },
    ];
    const edges = [
      { fromMatchId: "u1", toMatchId: "l1", fromResult: "loser" as const },
      { fromMatchId: "u1", toMatchId: "gf", fromResult: "winner" as const },
    ];
    const { laneIndexByContainer, positions } = layoutBracket(matches, edges, ["u", "l", "g"], opts);
    expect(laneIndexByContainer.get("g")).toBe(laneIndexByContainer.get("u"));
    expect(laneIndexByContainer.get("l")).toBe(1);
    expect(positions.get("gf")!.x).toBe(100);
  });

  it("floors the column on the round for a bye", () => {
    const { positions } = layoutBracket([{ id: "m", containerId: "u", round: 2 }], [], ["u"], opts);
    expect(positions.get("m")!.x).toBe(100);
  });
});
