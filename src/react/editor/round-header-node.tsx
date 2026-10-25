import type { NodeProps } from "@xyflow/react";
import { useEditorEnv } from "./context";
import type { RoundHeaderData } from "./types";

export const ROUND_HEADER_WIDTH = 224;
export const ROUND_HEADER_HEIGHT = 40;

// Column title, a dashed header marks where a match dropped there lands
export function RoundHeaderNode({ data }: NodeProps & { data: RoundHeaderData }) {
  const { labels } = useEditorEnv();
  return (
    <div className="nodrag nopan flex h-10 w-56 items-center justify-center rounded-lg border border-dashed border-border bg-muted/30 text-xs font-semibold text-muted-foreground">
      {labels.round(data.round)}
    </div>
  );
}
