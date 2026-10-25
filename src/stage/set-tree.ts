// A set groups containers under one name (Group Stage holding Group A and Group B).
// Containers without a parent stay at the root of the stage.

export type TreeId = string | number;

export type TreeRow<Id extends TreeId = TreeId> = {
  id: Id;
  parentId: Id | null;
  isSet: boolean;
  status: string;
};

export type TreeNode<Row extends TreeRow> = {
  row: Row;
  children: TreeNode<Row>[];
};

// Rows are expected in display order, siblings keep it
export function buildTree<Row extends TreeRow>(rows: readonly Row[]): TreeNode<Row>[] {
  const ids = new Set(rows.map((r) => r.id));
  const build = (parentId: Row["id"] | null): TreeNode<Row>[] =>
    rows.filter((r) => (r.parentId !== null && ids.has(r.parentId) ? r.parentId : null) === parentId).map((row) => ({ row, children: row.isSet ? build(row.id) : [] }));
  return build(null);
}

// The row and everything nested in it
export function subtreeOf<Row extends TreeRow>(rows: readonly Row[], rootId: Row["id"]): Row[] {
  const root = rows.find((r) => r.id === rootId);
  if (!root) return [];
  const found = new Map<Row["id"], Row>([[root.id, root]]);
  for (let grew = true; grew; ) {
    grew = false;
    for (const r of rows) {
      if (r.parentId !== null && found.has(r.parentId) && !found.has(r.id)) {
        found.set(r.id, r);
        grew = true;
      }
    }
  }
  return [...found.values()];
}

// The set and the sets above it
export function setChain<Row extends TreeRow>(rows: readonly Row[], startId: Row["id"] | null): Row["id"][] {
  const chain: Row["id"][] = [];
  for (let cur = rows.find((r) => r.id === startId); cur && !chain.includes(cur.id); cur = rows.find((r) => r.id === cur?.parentId)) chain.push(cur.id);
  return chain;
}

export type MoveCheck = "ok" | "notFound" | "parentInvalid";

// A container can go to the root (null) or into a set that is not itself or one of its own descendants
export function checkMove<Row extends TreeRow>(rows: readonly Row[], id: Row["id"], parentId: Row["id"] | null): MoveCheck {
  if (!rows.some((r) => r.id === id)) return "notFound";
  if (parentId === null) return "ok";
  const parent = rows.find((r) => r.id === parentId);
  if (!parent || !parent.isSet || subtreeOf(rows, id).some((r) => r.id === parentId)) return "parentInvalid";
  return "ok";
}

// Ids of the siblings once the container has been placed under parentId at index (the end by default)
export function placeAmongSiblings<Row extends TreeRow>(rows: readonly Row[], id: Row["id"], parentId: Row["id"] | null, index?: number): Row["id"][] {
  const ids = rows.filter((r) => r.parentId === parentId && r.id !== id).map((r) => r.id);
  ids.splice(Math.min(Math.max(index ?? ids.length, 0), ids.length), 0, id);
  return ids;
}

// Status of a set from what it holds: nothing started is pending, everything done is completed, anything else is active
export function aggregateStatus(statuses: readonly string[]): "pending" | "active" | "completed" {
  if (statuses.length === 0 || statuses.every((s) => s === "pending")) return "pending";
  if (statuses.every((s) => s === "completed")) return "completed";
  return "active";
}

// Status of every row, a set takes the one aggregated from the containers nested in it
export function resolveStatuses<Row extends TreeRow>(rows: readonly Row[]): Map<Row["id"], string> {
  const result = new Map<Row["id"], string>();
  for (const row of rows) {
    result.set(row.id, row.isSet ? aggregateStatus(subtreeOf(rows, row.id).filter((r) => !r.isSet).map((r) => r.status)) : row.status);
  }
  return result;
}
