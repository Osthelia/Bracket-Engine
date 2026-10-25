import { BaseEdge, type EdgeProps } from "@xyflow/react";

export interface ElbowEdgeData {
  // Set only for a cross lane link: a y inside the empty band between two lanes
  gutterY?: number;
}

const GAP_INSET = 18;

// Orthogonal connector. Same lane: one vertical jog at the midpoint between two columns.
// Cross lane: the long horizontal leg runs through the gutter between lanes, never across a match.
export function ElbowEdge({ id, sourceX, sourceY, targetX, targetY, style, markerEnd, data }: EdgeProps & { data?: ElbowEdgeData }) {
  const gutterY = data?.gutterY;
  const midX = sourceX + (targetX - sourceX) / 2;
  const direct = `M ${sourceX},${sourceY} L ${midX},${sourceY} L ${midX},${targetY} L ${targetX},${targetY}`;

  let path = direct;
  if (gutterY !== undefined) {
    const nearSourceX = sourceX + GAP_INSET;
    const nearTargetX = targetX - GAP_INSET;
    // Adjacent columns have no room for two insets, fall back to the direct path
    if (nearSourceX < nearTargetX) {
      path = `M ${sourceX},${sourceY} L ${nearSourceX},${sourceY} L ${nearSourceX},${gutterY} L ${nearTargetX},${gutterY} L ${nearTargetX},${targetY} L ${targetX},${targetY}`;
    }
  }

  return <BaseEdge id={id} path={path} {...(style ? { style } : {})} {...(markerEnd ? { markerEnd } : {})} />;
}
