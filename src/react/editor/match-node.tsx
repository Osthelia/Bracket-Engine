import { Handle, Position, type NodeProps } from "@xyflow/react";
import { cn } from "../cn";
import { useEditorEnv } from "./context";
import { TrashIcon } from "./icons";
import { SlotSourceControl } from "./slot-source-control";
import type { MatchNodeData } from "./types";

export const EDITOR_NODE_WIDTH = 224;
export const EDITOR_NODE_HEIGHT = 104;

export function EditorMatchNode({ data }: NodeProps & { data: MatchNodeData }) {
  const { labels, matchName } = useEditorEnv();
  const name = data.labelKey ? matchName(data.labelKey, data.labelParams ?? {}) : data.label;
  // A match that was played cannot be changed, only its place on the canvas
  const locked = data.readOnly || data.status === "live" || data.status === "completed";

  return (
    <div className={cn("w-56 rounded-lg border bg-card p-2 shadow-sm", data.invalid ? "border-destructive ring-2 ring-destructive/40" : "border-border")}>
      <Handle type="target" position={Position.Left} id="a" className="!size-3" style={{ top: "56%" }} />
      <Handle type="target" position={Position.Left} id="b" className="!size-3" style={{ top: "82%" }} />

      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="truncate text-[11px] font-medium text-muted-foreground">
          {data.containerName} · {labels.round(data.round)}
        </span>
        <div className="flex shrink-0 items-center gap-1.5">
          {data.invalid && <span className="text-[10px] font-semibold text-destructive">{labels.invalid}</span>}
          {!locked && (
            <button
              type="button"
              className="nodrag nopan cursor-pointer rounded text-muted-foreground transition-colors hover:text-destructive focus-visible:ring-2 focus-visible:ring-ring active:scale-90"
              title={labels.deleteMatch}
              aria-label={labels.deleteMatch}
              onClick={data.onDelete}
            >
              <TrashIcon className="size-3.5" />
            </button>
          )}
        </div>
      </div>
      <div className="mb-1 h-4 truncate text-xs font-semibold">{name}</div>

      <div className="flex flex-col gap-1">
        <SlotSourceControl source={data.slotA} fed={data.fedA} readOnly={locked} invalid={data.invalid} lookups={data.lookups} onChange={(source) => data.onSetSlot("a", source)} />
        <SlotSourceControl source={data.slotB} fed={data.fedB} readOnly={locked} invalid={data.invalid} lookups={data.lookups} onChange={(source) => data.onSetSlot("b", source)} />
      </div>

      <Handle type="source" position={Position.Right} id="winner" style={{ top: "56%" }} className="!size-3 !bg-emerald-500" />
      <Handle type="source" position={Position.Right} id="loser" style={{ top: "82%" }} className="!size-3 !bg-rose-500" />
    </div>
  );
}
