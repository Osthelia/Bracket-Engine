export type LaneNodeData = { name: string };

export const LANE_NODE_HEIGHT = 24;

// Title of a bracket lane when several brackets share one canvas
export function LaneNode({ data }: { data: LaneNodeData }) {
  return (
    <div className="flex items-center text-xs font-bold tracking-wider whitespace-nowrap text-muted-foreground uppercase" style={{ height: LANE_NODE_HEIGHT }}>
      {data.name}
    </div>
  );
}
