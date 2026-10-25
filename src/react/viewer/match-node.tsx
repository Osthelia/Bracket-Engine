import { Handle, Position, type NodeProps } from "@xyflow/react";
import { cn } from "../cn";
import { useViewerEnv } from "./context";
import type { BracketEntrantView } from "../../view/bracket-view";

export type MatchNodeData = {
  containerName: string;
  round: number;
  label: string | null;
  status: "pending" | "ready" | "live" | "completed";
  entrantA: BracketEntrantView | null;
  entrantB: BracketEntrantView | null;
  scoreA: number | null;
  scoreB: number | null;
  winnerSide: "a" | "b" | null;
  tbdLabel: string;
  href: string | null;
};

const HEADER_HEIGHT = 24;
const ROW_HEIGHT = 32;
const NODE_HEIGHT = HEADER_HEIGHT + ROW_HEIGHT * 2;
// Every handle sits at the vertical center so a same lane chain draws as a straight line
const CENTER_Y = NODE_HEIGHT / 2;

// Exported so the canvas can give each node an explicit size, otherwise React Flow hides it until measured
export const MATCH_NODE_WIDTH = 224;
export const MATCH_NODE_HEIGHT = NODE_HEIGHT;

const HANDLE_STYLE = { top: CENTER_Y, background: "transparent", border: "none" };

function SideRow({ entrant, score, isWinner, isLoser, tbdLabel }: { entrant: BracketEntrantView | null; score: number | null; isWinner: boolean; isLoser: boolean; tbdLabel: string }) {
  const { renderLogo } = useViewerEnv();
  return (
    <div className="flex items-center justify-between gap-2 px-2.5" style={{ height: ROW_HEIGHT }}>
      <span className="flex min-w-0 items-center gap-2">
        {entrant && renderLogo(entrant, cn("size-[18px] rounded text-[10px]", isLoser && "opacity-50"))}
        <span className={cn("truncate text-[12.5px]", isWinner ? "font-bold text-primary" : isLoser ? "font-medium text-subtle-foreground" : "font-medium text-foreground")}>
          {entrant?.name ?? tbdLabel}
        </span>
      </span>
      {score !== null && <span className={cn("font-mono text-[12.5px] tabular-nums", isWinner ? "font-extrabold text-primary" : "text-subtle-foreground")}>{score}</span>}
    </div>
  );
}

export function MatchNode({ data }: NodeProps & { data: MatchNodeData }) {
  const { renderLink } = useViewerEnv();
  const className = "nodrag nopan block w-56 overflow-hidden rounded-lg border border-border bg-card transition duration-150 hover:border-primary/50 hover:shadow-lg";

  const content = (
    <>
      <Handle type="target" position={Position.Left} id="a" style={HANDLE_STYLE} />
      <Handle type="target" position={Position.Left} id="b" style={HANDLE_STYLE} />

      <div className="flex items-center justify-between gap-2 border-b border-border bg-black/10 px-2.5" style={{ height: HEADER_HEIGHT }}>
        <span className="truncate text-[10px] font-semibold tracking-wide text-subtle-foreground uppercase">{data.label ?? `${data.containerName} R${data.round}`}</span>
        {data.status === "live" && (
          <span className="relative flex size-1.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-status-live opacity-75" />
            <span className="relative inline-flex size-1.5 rounded-full bg-status-live" />
          </span>
        )}
      </div>

      <div className="divide-y divide-border">
        <SideRow entrant={data.entrantA} score={data.scoreA} isWinner={data.winnerSide === "a"} isLoser={data.winnerSide === "b"} tbdLabel={data.tbdLabel} />
        <SideRow entrant={data.entrantB} score={data.scoreB} isWinner={data.winnerSide === "b"} isLoser={data.winnerSide === "a"} tbdLabel={data.tbdLabel} />
      </div>

      {/* Winner and loser leave from the same point, React Flow needs one handle per edge endpoint */}
      <Handle type="source" position={Position.Right} id="winner" style={HANDLE_STYLE} />
      <Handle type="source" position={Position.Right} id="loser" style={HANDLE_STYLE} />
    </>
  );

  if (!data.href) return <div className={className}>{content}</div>;
  return <>{renderLink({ href: data.href, className: cn(className, "active:scale-[0.98]"), children: content })}</>;
}
