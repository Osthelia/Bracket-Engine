import { Handle, Position, type NodeProps } from "@xyflow/react";
import { cn } from "../cn";

export type QualifierNodeData = {
  entrantName: string | null;
  tbdLabel: string;
  tooltip: string;
};

export const QUALIFIER_NODE_WIDTH = 160;
export const QUALIFIER_NODE_HEIGHT = 28;

// Slot showing where a winner or loser goes after leaving the bracket
export function QualifierNode({ data }: NodeProps & { data: QualifierNodeData }) {
  return (
    <div
      title={data.tooltip}
      className={cn("flex items-center rounded-md border border-dashed border-border bg-card px-2.5 text-[11.5px]", data.entrantName ? "font-semibold text-foreground" : "text-subtle-foreground")}
      style={{ width: QUALIFIER_NODE_WIDTH, height: QUALIFIER_NODE_HEIGHT }}
    >
      <Handle type="target" position={Position.Left} id="a" style={{ background: "transparent", border: "none" }} />
      <span className="truncate">{data.entrantName ?? data.tbdLabel}</span>
    </div>
  );
}
