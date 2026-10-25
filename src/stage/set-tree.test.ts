import { describe, expect, it } from "vitest";
import { aggregateStatus, buildTree, checkMove, placeAmongSiblings, resolveStatuses, setChain, subtreeOf, type TreeRow } from "./set-tree";

const row = (id: number, parentId: number | null, isSet = false, status = "pending"): TreeRow<number> => ({ id, parentId, isSet, status });

// 1 set > (2 group, 3 set > 4 bracket), 5 bracket at the root
const rows = [row(1, null, true), row(2, 1), row(3, 1, true), row(4, 3), row(5, null)];

describe("buildTree", () => {
  it("nests children under their set and keeps the order", () => {
    const tree = buildTree(rows);
    expect(tree.map((n) => n.row.id)).toEqual([1, 5]);
    expect(tree[0]!.children.map((n) => n.row.id)).toEqual([2, 3]);
    expect(tree[0]!.children[1]!.children.map((n) => n.row.id)).toEqual([4]);
  });

  it("keeps a flat stage flat", () => {
    expect(buildTree([row(1, null), row(2, null)]).map((n) => n.row.id)).toEqual([1, 2]);
  });

  it("puts a row with an unknown parent at the root", () => {
    expect(buildTree([row(1, 99)]).map((n) => n.row.id)).toEqual([1]);
  });
});

describe("subtreeOf and setChain", () => {
  it("collects every descendant", () => {
    expect(subtreeOf(rows, 1).map((r) => r.id).sort()).toEqual([1, 2, 3, 4]);
    expect(subtreeOf(rows, 5).map((r) => r.id)).toEqual([5]);
    expect(subtreeOf(rows, 42)).toEqual([]);
  });

  it("lists the set and the sets above", () => {
    expect(setChain(rows, 3)).toEqual([3, 1]);
    expect(setChain(rows, null)).toEqual([]);
  });
});

describe("checkMove", () => {
  it("accepts the root and a set", () => {
    expect(checkMove(rows, 5, null)).toBe("ok");
    expect(checkMove(rows, 5, 3)).toBe("ok");
  });

  it("refuses a container, itself and a descendant as parent", () => {
    expect(checkMove(rows, 5, 2)).toBe("parentInvalid");
    expect(checkMove(rows, 1, 1)).toBe("parentInvalid");
    expect(checkMove(rows, 1, 3)).toBe("parentInvalid");
  });

  it("reports an unknown container", () => {
    expect(checkMove(rows, 42, null)).toBe("notFound");
  });
});

describe("placeAmongSiblings", () => {
  it("appends by default and clamps the index", () => {
    expect(placeAmongSiblings(rows, 5, 1)).toEqual([2, 3, 5]);
    expect(placeAmongSiblings(rows, 5, 1, 0)).toEqual([5, 2, 3]);
    expect(placeAmongSiblings(rows, 5, 1, 99)).toEqual([2, 3, 5]);
  });

  it("does not repeat the moved container", () => {
    expect(placeAmongSiblings(rows, 2, 1, 1)).toEqual([3, 2]);
  });
});

describe("statuses", () => {
  it("aggregates", () => {
    expect(aggregateStatus([])).toBe("pending");
    expect(aggregateStatus(["pending", "pending"])).toBe("pending");
    expect(aggregateStatus(["completed", "completed"])).toBe("completed");
    expect(aggregateStatus(["completed", "pending"])).toBe("active");
    expect(aggregateStatus(["active"])).toBe("active");
  });

  it("gives a set the status of what it holds", () => {
    const withStatus = [row(1, null, true), row(2, 1, false, "completed"), row(3, 1, false, "active")];
    expect(resolveStatuses(withStatus).get(1)).toBe("active");
    expect(resolveStatuses(withStatus).get(2)).toBe("completed");
  });
});
