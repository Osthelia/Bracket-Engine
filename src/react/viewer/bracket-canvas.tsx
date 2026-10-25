import "@xyflow/react/dist/style.css";
import { useEffect, useMemo, useState } from "react";
import { Background, Controls, ReactFlow, ReactFlowProvider, type Edge, type Node } from "@xyflow/react";
import { layoutBracket } from "../../layout/bracket-layout";
import { resolveLabels, type BracketLabels, type DeepPartial } from "../labels";
import { useFlowColorMode } from "../use-flow-color-mode";
import { defaultViewerEnv, ViewerEnvContext, type ViewerEnv } from "./context";
import { ElbowEdge } from "./elbow-edge";
import { LANE_NODE_HEIGHT, LaneNode, type LaneNodeData } from "./lane-node";
import { MATCH_NODE_HEIGHT, MATCH_NODE_WIDTH, MatchNode, type MatchNodeData } from "./match-node";
import { QUALIFIER_NODE_HEIGHT, QUALIFIER_NODE_WIDTH, QualifierNode, type QualifierNodeData } from "./qualifier-node";
import type { BracketContainerView, BracketMatchView } from "../../view/bracket-view";

const WINNER_EDGE_COLOR = "#3fb96e";
const LOSER_EDGE_COLOR = "var(--status-live)";
const DEFAULT_EDGE_COLOR = "var(--primary)";

// Low enough for a deep triple elimination to fit the canvas
const MIN_ZOOM = 0.1;
const TOUCH_MIN_FIT_ZOOM = 0.55;
const COLUMN_WIDTH = 260;
const ROW_HEIGHT = 100;
const LANE_GAP = 50;
const QUALIFIER_GAP = 8;

const NODE_TYPES = { match: MatchNode, qualifier: QualifierNode, lane: LaneNode };
const EDGE_TYPES = { elbow: ElbowEdge };

// Live matches, else the first round still waiting for a result, else the last round: where a phone lands
function focusMatchIds(matches: BracketMatchView[]): string[] {
  if (matches.length === 0) return [];
  const live = matches.filter((m) => m.status === "live");
  if (live.length > 0) return live.map((m) => m.id);
  const waiting = matches.filter((m) => m.status !== "completed" && m.entrantA && m.entrantB);
  const pool = waiting.length > 0 ? waiting : matches;
  const round = waiting.length > 0 ? Math.min(...pool.map((m) => m.round)) : Math.max(...pool.map((m) => m.round));
  return pool.filter((m) => m.round === round).map((m) => m.id);
}

function useCoarsePointer(): boolean {
  const [coarse, setCoarse] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(pointer: coarse)");
    setCoarse(query.matches);
    const onChange = (e: MediaQueryListEvent) => setCoarse(e.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);
  return coarse;
}

// Read only bracket. Cross lane links (an upper loser dropping to lower) show only on hover to keep a big bracket readable.
export interface BracketCanvasProps {
  containers: BracketContainerView[];
  matchHref?: (matchId: string) => string;
  // Translated texts, anything missing stays in English
  labels?: DeepPartial<BracketLabels["viewer"]>;
  // Lets the host router handle the match links
  renderLink?: ViewerEnv["renderLink"];
  // Lets the host draw its own logos, the default shows the first letter when there is no image
  renderLogo?: ViewerEnv["renderLogo"];
}

export function BracketCanvas({ containers, matchHref, labels, renderLink, renderLogo }: BracketCanvasProps) {
  const env = useMemo<ViewerEnv>(
    () => ({
      labels: resolveLabels({ viewer: labels }).viewer,
      renderLink: renderLink ?? defaultViewerEnv.renderLink,
      renderLogo: renderLogo ?? defaultViewerEnv.renderLogo,
    }),
    [labels, renderLink, renderLogo],
  );
  return (
    <ViewerEnvContext.Provider value={env}>
      <Canvas containers={containers} matchHref={matchHref} t={env.labels} />
    </ViewerEnvContext.Provider>
  );
}

function Canvas({ containers, matchHref, t }: { containers: BracketContainerView[]; matchHref: ((matchId: string) => string) | undefined; t: BracketLabels["viewer"] }) {
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const touch = useCoarsePointer();
  const colorMode = useFlowColorMode();
  // On touch the canvas ignores gestures until tapped, so a vertical swipe still scrolls the page
  const [exploring, setExploring] = useState(false);
  const interactive = !touch || exploring;

  const { nodes, baseEdges, focusIds, height } = useMemo(() => {
    const tbdLabel = t.tbd;
    const layoutMatches = containers.flatMap((c) => c.matches.map((m) => ({ id: m.id, containerId: m.containerId, round: m.round, displayOrder: m.displayOrder })));
    const layoutEdges = containers.flatMap((c) => c.edges);
    const layout = layoutBracket(layoutMatches, layoutEdges, containers.map((c) => c.id), { columnWidth: COLUMN_WIDTH, rowHeight: ROW_HEIGHT, laneGap: LANE_GAP });
    const matchLane = new Map(layoutMatches.map((m) => [m.id, layout.laneIndexByContainer.get(m.containerId)]));
    // The link into a final always shows, nothing nearby to declutter against
    const feedingMatchIds = new Set(layoutEdges.map((e) => e.fromMatchId));

    const matchNodes: Node<MatchNodeData>[] = containers.flatMap((container) =>
      container.matches.map((m) => ({
        id: m.id,
        type: "match",
        position: layout.positions.get(m.id) ?? { x: 0, y: 0 },
        width: MATCH_NODE_WIDTH,
        height: MATCH_NODE_HEIGHT,
        data: {
          containerName: container.name,
          round: m.round,
          label: m.labelKey ? t.matchName(m.labelKey, m.labelParams ?? {}) : m.label,
          status: m.status,
          entrantA: m.entrantA,
          entrantB: m.entrantB,
          scoreA: m.scoreA,
          scoreB: m.scoreB,
          winnerSide: m.winnerId === null ? null : m.winnerId === m.entrantA?.id ? "a" : m.winnerId === m.entrantB?.id ? "b" : null,
          tbdLabel,
          href: matchHref ? matchHref(m.id) : null,
        },
        draggable: false,
        selectable: false,
      })),
    );

    // Qualifiers sit in an extra column after the last round of the source lane, level with their source
    const laneMaxX = new Map<number | undefined, number>();
    for (const m of layoutMatches) {
      const lane = matchLane.get(m.id);
      laneMaxX.set(lane, Math.max(laneMaxX.get(lane) ?? 0, layout.positions.get(m.id)?.x ?? 0));
    }
    const qualifiers = containers.flatMap((c) => c.qualifiers);
    const qualifierNodes: Node<QualifierNodeData>[] = qualifiers.map((q, i) => {
      const siblings = qualifiers.filter((o) => o.sourceMatchId === q.sourceMatchId);
      const offsetY = (siblings.indexOf(q) - (siblings.length - 1) / 2) * (QUALIFIER_NODE_HEIGHT + QUALIFIER_GAP);
      const pos = layout.positions.get(q.sourceMatchId) ?? { x: 0, y: 0 };
      return {
        id: `qualifier-${i}`,
        type: "qualifier",
        position: { x: (laneMaxX.get(matchLane.get(q.sourceMatchId)) ?? pos.x) + COLUMN_WIDTH, y: pos.y + (MATCH_NODE_HEIGHT - QUALIFIER_NODE_HEIGHT) / 2 + offsetY },
        width: QUALIFIER_NODE_WIDTH,
        height: QUALIFIER_NODE_HEIGHT,
        data: {
          entrantName: q.entrantName,
          tbdLabel,
          tooltip: q.entrantName
            ? t.qualified(q.entrantName, q.destination)
            : q.outcome === "winner"
              ? t.qualifiedWinner(q.destination)
              : t.qualifiedLoser(q.destination),
        },
        draggable: false,
        selectable: false,
      };
    });

    const qualifierEdges = qualifiers.map((q, i) => ({
      id: `${q.sourceMatchId}:${q.outcome}->qualifier-${i}`,
      source: q.sourceMatchId,
      target: `qualifier-${i}`,
      sourceHandle: q.outcome,
      targetHandle: "a",
      fromResult: q.outcome,
      crossLane: false,
      alwaysVisible: true,
      gutterY: undefined as number | undefined,
    }));

    const bracketEdges = layoutEdges.map((e) => {
      const sourceLane = matchLane.get(e.fromMatchId);
      const targetLane = matchLane.get(e.toMatchId);
      const crossLane = sourceLane !== targetLane;
      // The gutter is always just above the lower of the two lanes, in both directions
      const lowerLane = sourceLane !== undefined && targetLane !== undefined ? Math.max(sourceLane, targetLane) : targetLane;
      return {
        id: `${e.fromMatchId}:${e.fromResult}->${e.toMatchId}:${e.toSlot}`,
        source: e.fromMatchId,
        target: e.toMatchId,
        sourceHandle: e.fromResult,
        targetHandle: e.toSlot,
        fromResult: e.fromResult,
        crossLane,
        alwaysVisible: e.fromResult === "winner" && !feedingMatchIds.has(e.toMatchId),
        gutterY: crossLane && lowerLane !== undefined ? (layout.laneOffsetY.get(lowerLane) ?? 0) - LANE_GAP / 2 : undefined,
      };
    });

    // Each lane gets a title in the gap above it, only when there is more than one
    const laneNodes: Node<LaneNodeData>[] =
      containers.length > 1
        ? containers
            .filter((c, i) => containers.findIndex((o) => layout.laneIndexByContainer.get(o.id) === layout.laneIndexByContainer.get(c.id)) === i)
            .map((c) => ({
            id: `lane-${c.id}`,
            type: "lane",
            position: { x: 0, y: (layout.laneOffsetY.get(layout.laneIndexByContainer.get(c.id) ?? 0) ?? 0) - LANE_NODE_HEIGHT - 6 },
            width: 240,
            height: LANE_NODE_HEIGHT,
            data: { name: c.name },
            draggable: false,
            selectable: false,
          }))
        : [];

    return {
      nodes: [...laneNodes, ...matchNodes, ...qualifierNodes] as Node<Record<string, unknown>>[],
      baseEdges: [...bracketEdges, ...qualifierEdges],
      focusIds: focusMatchIds(containers.flatMap((c) => c.matches)),
      height: Math.max(360, layout.totalHeight),
    };
  }, [containers, matchHref, t]);

  const edges: Edge[] = useMemo(
    () =>
      baseEdges.map((e) => {
        const touchesHovered = hoveredNodeId !== null && (e.source === hoveredNodeId || e.target === hoveredNodeId);
        const visible = !e.crossLane || e.alwaysVisible || touchesHovered;
        const stroke = touchesHovered ? (e.fromResult === "winner" ? WINNER_EDGE_COLOR : LOSER_EDGE_COLOR) : DEFAULT_EDGE_COLOR;
        return {
          id: e.id,
          source: e.source,
          target: e.target,
          sourceHandle: e.sourceHandle,
          targetHandle: e.targetHandle,
          type: "elbow",
          data: { gutterY: e.gutterY },
          style: { stroke, strokeWidth: 1.5, opacity: visible ? 1 : 0, transition: "opacity 150ms, stroke 150ms" },
        };
      }),
    [baseEdges, hoveredNodeId],
  );

  if (nodes.length === 0) return null;

  return (
    <div className="relative animate-in overflow-hidden rounded-xl border border-border bg-card duration-300 fade-in-0" style={{ height: `min(${height}px, ${touch ? "55vh" : "75vh"})` }}>
      <ReactFlowProvider>
        <ReactFlow
          // Remount once the pointer type is known, fitView only runs on the first render
          key={touch ? "touch" : "mouse"}
          nodes={nodes}
          edges={edges}
          nodeTypes={NODE_TYPES}
          edgeTypes={EDGE_TYPES}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          onNodeMouseEnter={(_, node) => setHoveredNodeId(node.id)}
          onNodeMouseLeave={() => setHoveredNodeId(null)}
          panOnScroll={!touch}
          zoomOnScroll={false}
          zoomOnPinch={interactive}
          zoomOnDoubleClick={interactive}
          zoomActivationKeyCode="Control"
          panOnDrag={interactive}
          preventScrolling={interactive}
          fitView
          fitViewOptions={touch ? { padding: 0.15, nodes: focusIds.map((id) => ({ id })), minZoom: TOUCH_MIN_FIT_ZOOM, maxZoom: 1 } : { padding: 0.08 }}
          minZoom={MIN_ZOOM}
          colorMode={colorMode}
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={24} />
          <Controls showInteractive={false} />
        </ReactFlow>
      </ReactFlowProvider>

      {touch && !exploring && (
        <button type="button" onClick={() => setExploring(true)} className="absolute inset-0 z-10 flex items-end justify-center pb-4">
          <span className="rounded-lg bg-primary px-3.5 py-2 text-xs font-bold text-primary-foreground shadow-lg transition-transform active:scale-95">{t.explore}</span>
        </button>
      )}
      {touch && exploring && (
        <button
          type="button"
          onClick={() => setExploring(false)}
          className="absolute top-3 right-3 z-10 rounded-lg border border-border bg-secondary px-3 py-1.5 text-xs font-semibold text-secondary-foreground transition-transform hover:bg-accent active:scale-95"
        >
          {t.exploreDone}
        </button>
      )}
      {interactive && (
        <div className="pointer-events-none absolute bottom-3 left-1/2 z-10 -translate-x-1/2" aria-hidden="true">
          <span className="rounded bg-black/40 px-2 py-1 text-[10px] font-bold tracking-widest whitespace-nowrap text-muted-foreground uppercase backdrop-blur-sm">
            {touch ? (
              t.zoomHintTouch
            ) : (
              <>
                <kbd className="rounded bg-white/10 px-1 py-0.5">Ctrl</kbd> + {t.zoomHint}
              </>
            )}
          </span>
        </div>
      )}
    </div>
  );
}
