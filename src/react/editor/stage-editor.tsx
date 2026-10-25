import "@xyflow/react/dist/style.css";
import { useCallback, useMemo, useState, useTransition } from "react";
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
  type NodeChange,
  type OnEdgesChange,
  type OnNodeDrag,
  type OnNodesChange,
} from "@xyflow/react";
import { layoutEditorGrid, rowIndexFromY, snapToGrid, type EditorLayoutOptions } from "../../layout/editor-layout";
import type { CoreError } from "../../core/result";
import { groupRankOrder } from "../../stage/seeding";
import type { StageEditorData } from "../../stage/editor-types";
import { validateStageGraph, type SlotSource, type StageGraphEdge, type StageGraphMatch } from "../../stage/stage-graph";
import type { BracketLabels, DeepPartial } from "../labels";
import { useFlowColorMode } from "../use-flow-color-mode";
import { EditorProvider, useEditorEnv, type EditorUi } from "./context";
import { DeletableEdge } from "./deletable-edge";
import { EDITOR_NODE_HEIGHT, EDITOR_NODE_WIDTH, EditorMatchNode } from "./match-node";
import { ROUND_HEADER_HEIGHT, ROUND_HEADER_WIDTH, RoundHeaderNode } from "./round-header-node";
import type { EditorLookups, MatchNodeData, RoundHeaderData } from "./types";

const LAYOUT: EditorLayoutOptions = { columnWidth: 300, rowHeight: 140, laneGap: 80, headerHeight: 80 };
const NODE_TYPES = { match: EditorMatchNode, roundHeader: RoundHeaderNode };
const EDGE_TYPES = { deletable: DeletableEdge };
const EDGE_COLOR = { winner: "#10b981", loser: "#f43f5e" } as const;

type MatchNode = Node<MatchNodeData>;
type CanvasNode = MatchNode | Node<RoundHeaderData>;

function edgeOf(e: StageEditorData["edges"][number]): Edge {
  return {
    id: `${e.fromMatchId}:${e.fromResult}->${e.toMatchId}:${e.toSlot}`,
    source: e.fromMatchId,
    sourceHandle: e.fromResult,
    target: e.toMatchId,
    targetHandle: e.toSlot,
    type: "deletable",
    style: { stroke: EDGE_COLOR[e.fromResult] },
  };
}

// Errors keyed by field path, as the server returns them
export type FieldErrors = Record<string, { code: string; params?: Record<string, string | number> | undefined }>;

export type SaveResult = { ok: true } | { ok: false; errors: FieldErrors };

export interface StageEditorProps {
  data: StageEditorData;
  // Form controls of the host design system
  ui: EditorUi;
  // Persists the edited graph, the server validates it again and answers by field
  onSave: (graph: { matches: StageGraphMatch[]; edges: StageGraphEdge[] }) => Promise<SaveResult>;
  // Called once a save went through, usually to refresh the data
  onSaved?: () => void;
  // Turns a validation error into a readable sentence, the code is shown as is without it
  errorMessage?: (error: Pick<CoreError, "code" | "params">) => string;
  // Name of a generated match from its key, defaults to the English names
  matchName?: (key: string, params: Record<string, number>) => string;
  labels?: DeepPartial<BracketLabels["editor"]>;
}

export function StageEditor({ ui, labels, matchName, ...props }: StageEditorProps) {
  return (
    <EditorProvider ui={ui} labels={labels} matchName={matchName}>
      <ReactFlowProvider>
        <Inner {...props} />
      </ReactFlowProvider>
    </EditorProvider>
  );
}

function Inner({ data, onSave, onSaved, errorMessage }: Omit<StageEditorProps, "ui" | "labels" | "matchName">) {
  const { ui, labels: t } = useEditorEnv();
  const { Button, Input, Select, ConfirmDialog, Spinner } = ui;
  const message = errorMessage ?? ((e: Pick<CoreError, "code">) => e.code);
  const colorMode = useFlowColorMode();
  const [saving, startSaving] = useTransition();

  const lookups: EditorLookups = useMemo(() => ({ entrants: data.entrants, rankSources: data.rankSources, outcomeSources: data.outcomeSources }), [data]);
  const containerName = useMemo(() => new Map(data.containers.map((c) => [c.id, c.name])), [data.containers]);
  const groupContainers = useMemo(() => new Set(data.containers.filter((c) => c.containerType === "group").map((c) => c.id)), [data.containers]);

  const initial = useMemo(() => {
    const layout = layoutEditorGrid(data.matches, data.containers.map((c) => c.id), LAYOUT);
    const nodes: MatchNode[] = data.matches.map((m) => ({
      id: m.id,
      type: "match",
      position: layout.positions.get(m.id) ?? { x: 0, y: 0 },
      width: EDITOR_NODE_WIDTH,
      height: EDITOR_NODE_HEIGHT,
      data: {
        containerId: m.containerId,
        containerName: containerName.get(m.containerId) ?? "",
        round: m.round,
        label: m.label,
        labelKey: m.labelKey,
        labelParams: m.labelParams,
        bestOf: m.bestOf,
        status: m.status,
        slotA: m.slotA,
        slotB: m.slotB,
        fedA: false,
        fedB: false,
        invalid: false,
        readOnly: data.locked,
        lookups,
        onSetSlot: () => {},
        onDelete: () => {},
      },
    }));
    return { layout, nodes, edges: data.edges.map(edgeOf) };
  }, [data, containerName, lookups]);

  const [nodes, setNodes, onNodesChange] = useNodesState<MatchNode>(initial.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(initial.edges);
  const [nextId, setNextId] = useState(1);
  const [addContainerId, setAddContainerId] = useState(data.containers[0]?.id ?? "");
  const [addRound, setAddRound] = useState("1");
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [serverErrors, setServerErrors] = useState<FieldErrors>({});
  const [saved, setSaved] = useState(false);

  const readOnly = data.locked;

  const setSlot = useCallback(
    (nodeId: string, slot: "a" | "b", source: SlotSource) => {
      // Choosing a source replaces the link that fed the slot
      setEdges((prev) => prev.filter((e) => !(e.target === nodeId && e.targetHandle === slot)));
      setNodes((prev) => prev.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, ...(slot === "a" ? { slotA: source } : { slotB: source }) } } : n)));
      setSaved(false);
    },
    [setEdges, setNodes],
  );

  const deleteEdge = useCallback(
    (edge: Edge) => {
      setEdges((prev) => prev.filter((e) => e.id !== edge.id));
      setSaved(false);
    },
    [setEdges],
  );

  const deleteNode = useCallback(
    (nodeId: string) => {
      setNodes((prev) => prev.filter((n) => n.id !== nodeId));
      setEdges((prev) => prev.filter((e) => e.source !== nodeId && e.target !== nodeId));
      setSaved(false);
    },
    [setNodes, setEdges],
  );

  const fedSlots = useMemo(() => new Set(edges.map((e) => `${e.target}:${e.targetHandle}`)), [edges]);

  // The graph as the server will receive it
  const graphMatches: StageGraphMatch[] = useMemo(
    () =>
      nodes.map((n) => ({
        id: n.id,
        containerId: n.data.containerId,
        round: n.data.round,
        displayOrder: rowIndexFromY(n.position.y, n.data.containerId, initial.layout, LAYOUT),
        label: n.data.label,
        labelKey: n.data.labelKey,
        labelParams: n.data.labelParams,
        bestOf: n.data.bestOf,
        slotA: fedSlots.has(`${n.id}:a`) ? { type: "unset" } : n.data.slotA,
        slotB: fedSlots.has(`${n.id}:b`) ? { type: "unset" } : n.data.slotB,
      })),
    [nodes, fedSlots, initial.layout],
  );
  const graphEdges = useMemo(
    () => edges.map((e) => ({ fromMatchId: e.source, fromResult: e.sourceHandle as "winner" | "loser", toMatchId: e.target, toSlot: e.targetHandle as "a" | "b" })),
    [edges],
  );

  const validation = useMemo(() => validateStageGraph({ matches: graphMatches, edges: graphEdges }, { sharedSeedContainers: groupContainers }), [graphMatches, graphEdges, groupContainers]);
  const errorList = useMemo(() => {
    const list = validation.ok ? [] : validation.errors.map((e) => ({ code: e.code, path: e.path, params: e.params }));
    return [...list, ...Object.entries(serverErrors).map(([path, e]) => ({ code: e.code, path, params: e.params }))];
  }, [validation, serverErrors]);
  const invalidIds = useMemo(() => new Set(errorList.map((e) => /^matches\.([^.]+)\./.exec(e.path)?.[1]).filter((id): id is string => !!id)), [errorList]);

  const displayNodes: CanvasNode[] = useMemo(() => {
    const matchNodes = nodes.map((n) => ({
      ...n,
      draggable: !readOnly && n.data.status !== "live" && n.data.status !== "completed",
      data: {
        ...n.data,
        fedA: fedSlots.has(`${n.id}:a`),
        fedB: fedSlots.has(`${n.id}:b`),
        invalid: invalidIds.has(n.id),
        readOnly,
        onSetSlot: (slot: "a" | "b", source: SlotSource) => setSlot(n.id, slot, source),
        onDelete: () => setPendingDelete(n.id),
      },
    }));

    // One header per round of each lane, plus a trailing one to drop a match into the next round
    const roundsByContainer = new Map<string, Set<number>>();
    for (const n of nodes) roundsByContainer.set(n.data.containerId, (roundsByContainer.get(n.data.containerId) ?? new Set<number>()).add(n.data.round));
    const headers: Node<RoundHeaderData>[] = [];
    for (const c of data.containers) {
      const rounds = roundsByContainer.get(c.id) ?? new Set<number>();
      const last = rounds.size > 0 ? Math.max(...rounds) : 0;
      for (let round = 1; round <= last + 1; round++) {
        headers.push({
          id: `round-${c.id}-${round}`,
          type: "roundHeader",
          position: { x: (round - 1) * LAYOUT.columnWidth, y: initial.layout.laneOffsetY.get(c.id) ?? 0 },
          draggable: false,
          selectable: false,
          // A known size keeps the node visible without waiting for a measure
          width: ROUND_HEADER_WIDTH,
          height: ROUND_HEADER_HEIGHT,
          data: { containerName: c.name, round },
        });
      }
    }
    return [...matchNodes, ...headers];
  }, [nodes, fedSlots, invalidIds, readOnly, data.containers, initial.layout, setSlot]);

  const displayEdges = useMemo(
    () => edges.map((e) => ({ ...e, type: "deletable", data: { onDelete: () => deleteEdge(e), readOnly } })),
    [edges, deleteEdge, readOnly],
  );

  const handleNodesChange: OnNodesChange<CanvasNode> = useCallback(
    (changes) => {
      // Round headers are decoration, only the matches are tracked
      const own = changes.filter((c) => "id" in c && nodes.some((n) => n.id === c.id)) as NodeChange<MatchNode>[];
      onNodesChange(own);
    },
    [onNodesChange, nodes],
  );

  const handleEdgesChange: OnEdgesChange<Edge> = useCallback(
    (changes) => {
      onEdgesChange(changes);
      if (changes.some((c) => c.type === "remove")) setSaved(false);
    },
    [onEdgesChange],
  );

  const onConnect = useCallback(
    (c: Connection) => {
      if (readOnly || !c.target || !c.source) return;
      const slot = c.targetHandle as "a" | "b";
      setEdges((prev) => addEdge({ ...c, type: "deletable", style: { stroke: EDGE_COLOR[(c.sourceHandle as "winner" | "loser") ?? "winner"] } }, prev.filter((e) => !(e.target === c.target && e.targetHandle === slot))));
      setSaved(false);
    },
    [readOnly, setEdges],
  );

  const onNodeDragStop: OnNodeDrag<CanvasNode> = useCallback(
    (_event, node) => {
      if (readOnly || node.type !== "match") return;
      const containerId = (node.data as MatchNodeData).containerId;
      const snapped = snapToGrid(node.position.x, node.position.y, containerId, initial.layout, LAYOUT);
      setNodes((prev) => prev.map((n) => (n.id === node.id ? { ...n, position: { x: snapped.x, y: snapped.y }, data: { ...n.data, round: snapped.round } } : n)));
      setSaved(false);
    },
    [readOnly, initial.layout, setNodes],
  );

  function addMatch() {
    const round = Math.max(1, Math.min(99, Math.trunc(Number(addRound)) || 1));
    if (!addContainerId) return;
    const id = `new-${nextId}`;
    setNextId((n) => n + 1);
    const inColumn = nodes.filter((n) => n.data.containerId === addContainerId && n.data.round === round).length;
    const laneTop = initial.layout.laneOffsetY.get(addContainerId) ?? 0;
    setNodes((prev) => [
      ...prev,
      {
        id,
        type: "match",
        position: { x: (round - 1) * LAYOUT.columnWidth, y: laneTop + LAYOUT.headerHeight + inColumn * LAYOUT.rowHeight },
        width: EDITOR_NODE_WIDTH,
        height: EDITOR_NODE_HEIGHT,
        data: {
          containerId: addContainerId,
          containerName: containerName.get(addContainerId) ?? "",
          round,
          label: null,
          labelKey: null,
          labelParams: null,
          bestOf: 1,
          status: "pending",
          slotA: { type: "unset" },
          slotB: { type: "unset" },
          fedA: false,
          fedB: false,
          invalid: false,
          readOnly: false,
          lookups,
          onSetSlot: () => {},
          onDelete: () => {},
        },
      },
    ]);
    setSaved(false);
  }

  function fillFromGroups(sourceIds: string[], targetContainerId: string) {
    const order = groupRankOrder(data.rankSources.filter((g) => sourceIds.includes(g.id)));
    setNodes((prev) =>
      prev.map((n) => {
        if (n.data.containerId !== targetContainerId) return n;
        const apply = (source: SlotSource, fed: boolean): SlotSource => {
          const entry = source.type === "seed" && !fed ? order[source.seed - 1] : undefined;
          return entry ? { type: "group_rank", containerId: entry.containerId, rank: entry.rank } : source;
        };
        return { ...n, data: { ...n.data, slotA: apply(n.data.slotA, fedSlots.has(`${n.id}:a`)), slotB: apply(n.data.slotB, fedSlots.has(`${n.id}:b`)) } };
      }),
    );
    setSaved(false);
  }

  function save() {
    setServerErrors({});
    startSaving(async () => {
      const res = await onSave({ matches: graphMatches, edges: graphEdges });
      if (!res.ok) {
        setServerErrors(res.errors);
        return;
      }
      setSaved(true);
      onSaved?.();
    });
  }

  const bracketContainers = data.containers;

  return (
    <div className="flex flex-col gap-3">
      {readOnly && <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">{t.lockedNotice}</p>}

      {!readOnly && (
        <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-muted/30 p-3">
          <div className="flex w-48 flex-col gap-1">
            <label htmlFor="add-container" className="text-xs font-medium">
              {t.addMatch.container} <span className="text-destructive" aria-hidden="true">*</span>
            </label>
            <Select id="add-container" value={addContainerId} onValueChange={setAddContainerId} options={bracketContainers.map((c) => ({ value: c.id, label: c.name }))} />
          </div>
          <div className="flex w-20 flex-col gap-1">
            <label htmlFor="add-round" className="text-xs font-medium">
              {t.addMatch.round} <span className="text-destructive" aria-hidden="true">*</span>
            </label>
            <Input id="add-round" inputMode="numeric" value={addRound} onChange={(e) => setAddRound(e.target.value)} />
          </div>
          <Button type="button" variant="outline" onClick={addMatch}>
            {t.addMatch.button}
          </Button>
          {data.rankSources.length > 0 && <FillFromGroups data={data} onApply={fillFromGroups} />}
          <p className="basis-full text-xs text-muted-foreground">{t.addMatch.hint}</p>
        </div>
      )}

      <div className="h-[640px] rounded-lg border border-border [&_.react-flow__edgelabel-renderer]:z-[2000]">
        <ReactFlow<CanvasNode>
          nodes={displayNodes}
          edges={displayEdges}
          nodeTypes={NODE_TYPES}
          edgeTypes={EDGE_TYPES}
          {...(readOnly ? {} : { onNodesChange: handleNodesChange, onEdgesChange: handleEdgesChange, onConnect })}
          onNodeDragStop={onNodeDragStop}
          nodesConnectable={!readOnly}
          nodesDraggable={!readOnly}
          elementsSelectable={!readOnly}
          colorMode={colorMode}
          panOnScroll
          zoomOnScroll={false}
          zoomActivationKeyCode="Control"
          minZoom={0.1}
          fitView
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={24} />
          <Controls />
          <MiniMap pannable zoomable />
        </ReactFlow>
      </div>

      {!readOnly && (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" onClick={save} disabled={saving || errorList.length > 0}>
              {saving && <Spinner />}
              {t.save}
            </Button>
            {errorList.length === 0 && saved && !saving && <span role="status" className="text-sm text-muted-foreground">{t.saved}</span>}
            {errorList.length === 0 && !saved && <span className="text-sm text-muted-foreground">{t.valid}</span>}
            {errorList.length > 0 && <span className="text-sm text-destructive">{t.errorCount(errorList.length)}</span>}
          </div>
          {errorList.length > 0 && (
            <ul role="alert" className="flex flex-col gap-1 text-sm text-destructive">
              {errorList.map((e, i) => (
                <li key={`${e.path}-${i}`}>{message({ code: e.code, ...(e.params ? { params: e.params } : {}) })}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title={t.deleteTitle}
        description={t.deleteConfirm}
        confirmLabel={t.deleteMatch}
        cancelLabel={t.cancel}
        onConfirm={() => pendingDelete && deleteNode(pendingDelete)}
      />
    </div>
  );
}

// Seeds the slots of a bracket from the ranks of earlier groups, first places first
function FillFromGroups({ data, onApply }: { data: StageEditorData; onApply: (sourceIds: string[], containerId: string) => void }) {
  const { ui, labels: t } = useEditorEnv();
  const { Button, Checkbox, Popover, PopoverContent, PopoverTrigger, Select } = ui;
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>(data.rankSources.map((g) => g.id));
  const [target, setTarget] = useState(data.containers.find((c) => c.containerType === "bracket")?.id ?? data.containers[0]?.id ?? "");
  const toggle = (id: string, on: boolean) => setSelected((s) => (on ? [...s, id] : s.filter((x) => x !== id)));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<Button type="button" variant="outline" />}>{t.fill.button}</PopoverTrigger>
      <PopoverContent className="flex w-80 flex-col gap-3">
        <p className="text-xs text-muted-foreground">{t.fill.description}</p>
        <div className="flex flex-col gap-1">
          <label htmlFor="fill-target" className="text-xs font-medium">
            {t.fill.target} <span className="text-destructive" aria-hidden="true">*</span>
          </label>
          <Select id="fill-target" value={target} onValueChange={setTarget} options={data.containers.map((c) => ({ value: c.id, label: c.name }))} />
        </div>
        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-1 text-xs font-medium">
            {t.fill.groups} <span className="text-destructive" aria-hidden="true">*</span>
          </legend>
          {data.rankSources.map((g) => (
            <label key={g.id} className="flex cursor-pointer items-center gap-2 text-sm">
              <Checkbox checked={selected.includes(g.id)} onCheckedChange={(checked) => toggle(g.id, checked === true)} />
              <span className="truncate">
                {g.stageName} / {g.name}
              </span>
              <span className="ml-auto text-xs text-muted-foreground">{t.fill.size(g.size)}</span>
            </label>
          ))}
        </fieldset>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>
            {t.cancel}
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={selected.length === 0 || !target}
            onClick={() => {
              onApply(selected, target);
              setOpen(false);
            }}
          >
            {t.apply}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
