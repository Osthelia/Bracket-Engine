import { BaseEdge, EdgeLabelRenderer, getBezierPath, type Edge, type EdgeProps } from "@xyflow/react";
import { useEditorEnv } from "./context";
import { XIcon } from "./icons";
import type { DeletableEdgeData } from "./types";

export type DeletableEdgeType = Edge<DeletableEdgeData>;

// Curved link with a cross to remove it. The cross lives in the edge label layer,
// which the canvas lifts above the nodes so a match never hides it.
export function DeletableEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, style, markerEnd, data }: EdgeProps<DeletableEdgeType>) {
  const { labels } = useEditorEnv();
  const [path, labelX, labelY] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition });

  return (
    <>
      <BaseEdge id={id} path={path} {...(style ? { style } : {})} {...(markerEnd ? { markerEnd } : {})} />
      {data && !data.readOnly && (
        <EdgeLabelRenderer>
          <button
            type="button"
            title={labels.deleteLink}
            aria-label={labels.deleteLink}
            className="nodrag nopan pointer-events-auto absolute flex size-5 cursor-pointer items-center justify-center rounded-full border border-border bg-background text-muted-foreground shadow-sm transition-all hover:border-destructive hover:bg-destructive hover:text-white focus-visible:ring-2 focus-visible:ring-ring active:scale-90"
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
            onClick={(e) => {
              e.stopPropagation();
              data.onDelete();
            }}
          >
            <XIcon className="size-3" />
          </button>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
