import { describe, expect, it } from "vitest";
import { validateStageGraph, type StageGraphMatch, type SlotSource } from "./stage-graph";

const unset: SlotSource = { type: "unset" };
const match = (id: string, over: Partial<StageGraphMatch> = {}): StageGraphMatch => ({ id, containerId: "c", round: 1, displayOrder: null, label: null, bestOf: 1, slotA: unset, slotB: unset, ...over });
const codes = (r: { ok: boolean; errors?: { code: string; path: string }[] }) => (r.ok ? [] : r.errors!.map((e) => `${e.path}:${e.code}`));

describe("validateStageGraph", () => {
  it("accepts a bracket that is entirely TBD", () => {
    const r = validateStageGraph({ matches: [match("a"), match("b"), match("f", { round: 2 })], edges: [{ fromMatchId: "a", fromResult: "winner", toMatchId: "f", toSlot: "a" }, { fromMatchId: "b", fromResult: "winner", toMatchId: "f", toSlot: "b" }] });
    expect(r.ok).toBe(true);
  });

  it("checks each match field", () => {
    const r = validateStageGraph({ matches: [match("a", { round: 0, bestOf: 100, label: "x".repeat(61) })], edges: [] });
    expect(codes(r)).toEqual(["matches.a.round:bracket.match.round.invalid", "matches.a.bestOf:bracket.match.bestOf.invalid", "matches.a.label:bracket.match.label.tooLong"]);
  });

  it("refuses a slot fed twice, by two edges or by an edge and a source", () => {
    const twoEdges = validateStageGraph({
      matches: [match("a"), match("b"), match("f")],
      edges: [{ fromMatchId: "a", fromResult: "winner", toMatchId: "f", toSlot: "a" }, { fromMatchId: "b", fromResult: "winner", toMatchId: "f", toSlot: "a" }],
    });
    expect(codes(twoEdges)).toEqual(["matches.f.slotA:bracket.graph.slotFedTwice"]);
    const both = validateStageGraph({
      matches: [match("a"), match("f", { slotA: { type: "bye" } })],
      edges: [{ fromMatchId: "a", fromResult: "winner", toMatchId: "f", toSlot: "a" }],
    });
    expect(codes(both)).toEqual(["matches.f.slotA:bracket.graph.slotFedTwice"]);
  });

  it("refuses unknown matches and cycles", () => {
    expect(codes(validateStageGraph({ matches: [match("a")], edges: [{ fromMatchId: "a", fromResult: "winner", toMatchId: "zz", toSlot: "a" }] }))).toEqual(["edges.a.zz:bracket.edge.unknownMatch"]);
    const cycle = validateStageGraph({
      matches: [match("a"), match("b")],
      edges: [{ fromMatchId: "a", fromResult: "winner", toMatchId: "b", toSlot: "a" }, { fromMatchId: "b", fromResult: "winner", toMatchId: "a", toSlot: "a" }],
    });
    expect(codes(cycle)).toEqual(["edges:bracket.graph.cycle"]);
  });

  it("checks sources and refuses a seed or a group rank used twice", () => {
    const r = validateStageGraph({
      matches: [
        match("a", { slotA: { type: "seed", seed: 1 }, slotB: { type: "seed", seed: 0 } }),
        match("b", { slotA: { type: "seed", seed: 2 }, slotB: { type: "group_rank", containerId: "g", rank: 1 } }),
        match("c", { slotA: { type: "group_rank", containerId: "g", rank: 2 }, slotB: { type: "match_outcome", matchId: "m", outcome: "winner" } }),
      ],
      edges: [],
    });
    expect(codes(r)).toEqual(["matches.a.slotB:bracket.seed.invalid"]);
    const dup = validateStageGraph({
      matches: [
        match("a", { slotA: { type: "seed", seed: 1 } }),
        match("b", { slotA: { type: "seed", seed: 1 }, slotB: { type: "group_rank", containerId: "g", rank: 1 } }),
        match("c", { slotA: { type: "group_rank", containerId: "g", rank: 1 } }),
      ],
      edges: [],
    });
    expect(codes(dup)).toEqual(["matches.b.slotA:bracket.seed.duplicate", "matches.c.slotA:bracket.groupRank.duplicate"]);

    // Two containers may each use seed 1, and a group reuses its seeds on purpose
    const twoContainers = validateStageGraph({ matches: [match("a", { slotA: { type: "seed", seed: 1 } }), match("b", { containerId: "d", slotA: { type: "seed", seed: 1 } })], edges: [] });
    expect(twoContainers.ok).toBe(true);
    const group = validateStageGraph({ matches: [match("a", { slotA: { type: "seed", seed: 1 } }), match("b", { slotA: { type: "seed", seed: 1 } })], edges: [] }, { sharedSeedContainers: new Set(["c"]) });
    expect(group.ok).toBe(true);
  });
});
