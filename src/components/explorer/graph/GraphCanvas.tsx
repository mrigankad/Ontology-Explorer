"use client";

import "@xyflow/react/dist/base.css";
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import {
  Background,
  BackgroundVariant,
  MiniMap,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  useStore,
  type Edge,
  type Node,
  type NodeChange,
} from "@xyflow/react";
import type { EdgeSummary, EntitySummary, EvidenceRow, OntologyType } from "@/lib/ontology/types";
import { NODE_H, NODE_W, ROOT_H, ROOT_W, zoneNodeId, type Bundle, type Point, type Zone } from "@/lib/ontology/graph-model";
import { Icon, Segmented } from "../controls";
import { STATE_META } from "../ui";
import { CanvasActionsContext, type CanvasActions } from "./canvas-context";
import { EdgeMarkers, edgeTypes } from "./edges";
import { planLabels, routePath, type Box } from "./geometry";
import { NodeMenu, type MenuAction } from "./NodeMenu";
import { nodeTypes, type Emphasis } from "./nodes";

export type LinkMode = "bundled" | "all";

const zoomSelector = (s: { transform: [number, number, number] }) => s.transform[2];

/** Keep the legend (top) and toolbar (bottom) clear of the fitted graph. */
const fitPadding = (top: number) => ({ top: `${top}px`, bottom: "64px", left: "20px", right: "20px" }) as const;

export interface GraphCanvasProps {
  rootId: string;
  nodes: EntitySummary[];
  edges: EdgeSummary[];
  positions: Map<string, Point>;
  zones: Zone[];
  types: Map<string, OntologyType>;
  selectedNode: string | null;
  selectedEdge: string | null;
  hovered: string | null;
  pathIds: string[];
  /** Links per node that exist but aren't loaded/visible. */
  hiddenLinks: Map<string, number>;
  /** Family-pair bundles and the ids of links that never bundle. */
  bundles: Bundle[];
  looseEdges: Set<string>;
  openBundles: Set<string>;
  linkMode: LinkMode;
  /** True when filters force every link to be drawn. */
  linkModeLocked: boolean;
  evidence: { anchorId: string; rows: EvidenceRow[] } | null;
  focusRequest: { ids: string[]; nonce: number } | null;
  reducedMotion: boolean;
  /** Changes whenever filters change; the canvas refits to what's left. */
  fitKey: string;
  /** Space to keep clear at the top when fitting (legend, filter chips). */
  reserveTop: number;
  /** Rendered in the top bar beside the legend (active filter chips). */
  topBarExtra?: React.ReactNode;
  /** Canvas-internal callbacks (band hover) are added by GraphCanvas itself. */
  actions: Omit<CanvasActions, "hoverBundle">;
  onMenuAction: (action: MenuAction, id: string) => void;
  onHelp: () => void;
  onLinkMode: (m: LinkMode) => void;
  onExpand: (id: string) => void;
  onHover: (id: string | null) => void;
  onMove: (id: string, p: Point) => void;
  onClear: () => void;
}

/**
 * Rendering adapter. The rest of the explorer never imports React Flow, so the
 * renderer can be swapped (e.g. for a WebGL one on very large graphs) by
 * reimplementing this component against the same props.
 */
export function GraphCanvas(props: GraphCanvasProps) {
  // Transient hover state lives here so edge components can report it through context.
  const [hoveredBundle, setHoveredBundle] = useState<string | null>(null);
  const actions = useMemo(() => ({ ...props.actions, hoverBundle: setHoveredBundle }), [props.actions]);
  // Selecting something fades the bands (and disables their badges), so a
  // pointer-leave may never arrive: drop any band hover when the selection changes.
  const selKey = `${props.selectedNode}|${props.selectedEdge}`;
  const [prevSel, setPrevSel] = useState(selKey);
  if (prevSel !== selKey) {
    setPrevSel(selKey);
    setHoveredBundle(null);
  }
  const activeBundle = props.selectedNode || props.selectedEdge ? null : hoveredBundle;
  return (
    <ReactFlowProvider>
      <CanvasActionsContext.Provider value={actions}>
        <Canvas {...props} hoveredBundle={activeBundle} />
      </CanvasActionsContext.Provider>
    </ReactFlowProvider>
  );
}

function Canvas({
  rootId,
  nodes,
  edges,
  positions,
  zones,
  types,
  selectedNode,
  selectedEdge,
  hovered,
  pathIds,
  hiddenLinks,
  bundles,
  looseEdges,
  openBundles,
  linkMode,
  linkModeLocked,
  evidence,
  focusRequest,
  reducedMotion,
  fitKey,
  reserveTop,
  topBarExtra,
  actions,
  onMenuAction,
  onHelp,
  onLinkMode,
  onExpand,
  onHover,
  onMove,
  onClear,
  hoveredBundle,
}: GraphCanvasProps & { hoveredBundle: string | null }) {
  const rf = useReactFlow();
  const [hoveredEdge, setHoveredEdge] = useState<string | null>(null);
  const FIT_PADDING = useMemo(() => fitPadding(reserveTop), [reserveTop]);
  const [showMap, setShowMap] = useState(true);
  const [menu, setMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  // First paint gets one orchestrated entrance (zones rise in turn); afterwards
  // new elements appear without delay so interactions feel immediate.
  const [intro, setIntro] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setIntro(false), 1400);
    return () => clearTimeout(t);
  }, []);
  const closeMenu = useCallback(() => setMenu(null), []);

  // Links along the traversal trail (consecutive hops), drawn with a halo.
  const pathEdges = useMemo(() => {
    const ids = new Set<string>();
    for (let i = 1; i < pathIds.length; i++) {
      const a = pathIds[i - 1];
      const b = pathIds[i];
      const e =
        edges.find((x) => x.subjectId === a && x.objectId === b) ?? edges.find((x) => x.subjectId === b && x.objectId === a);
      if (e) ids.add(e.id);
    }
    return ids;
  }, [edges, pathIds]);

  // Neighbourhood emphasis: selection is persistent, hover is transient.
  const emphasis = useMemo(() => {
    const focusNodes = new Set<string>();
    const focusEdges = new Set<string>();
    const anchor = selectedNode ?? hovered;
    if (selectedEdge) {
      const e = edges.find((x) => x.id === selectedEdge);
      if (e) {
        focusNodes.add(e.subjectId).add(e.objectId);
        focusEdges.add(e.id);
      }
    } else if (anchor) {
      focusNodes.add(anchor);
      for (const e of edges) {
        if (e.subjectId === anchor || e.objectId === anchor) {
          focusEdges.add(e.id);
          focusNodes.add(e.subjectId).add(e.objectId);
        }
      }
    }
    // A hovered link lights up with its two ends, on top of any selection.
    const he = hoveredEdge ? edges.find((x) => x.id === hoveredEdge) : undefined;
    if (he) {
      focusEdges.add(he.id);
      focusNodes.add(he.subjectId).add(he.objectId);
    }
    // Keep the trail in focus alongside the selection so a found path stays readable.
    if (focusNodes.size > 0 && selectedNode) {
      for (const id of pathIds) focusNodes.add(id);
      for (const id of pathEdges) focusEdges.add(id);
    }
    return { active: focusNodes.size > 0, focusNodes, focusEdges };
  }, [edges, selectedNode, selectedEdge, hovered, hoveredEdge, pathIds, pathEdges]);

  const pathSet = useMemo(() => new Set(pathIds), [pathIds]);
  const zoom = useStore(zoomSelector);

  // Plan where each band's badge sits so badges never pile up on each other or
  // on the company node. Badges keep a constant on-screen size, so their size in
  // flow units depends on zoom (bucketed to avoid replanning on every wheel tick).
  const zoomBucket = Math.round(Math.min(Math.max(zoom, 0.2), 1.4) * 20) / 20;
  /** Below this zoom, zones collapse to labelled blocks (semantic zoom). */
  const compact = zoom < 0.42 && linkMode === "bundled";
  const labelPlan = useMemo(() => {
    if (linkMode !== "bundled") return new Map<string, number>();
    const zoneBox = new Map<string, Box>(zones.map((z) => [zoneNodeId(z.family), { x: z.x + z.w / 2, y: z.y + z.h / 2, w: z.w, h: z.h }]));
    const rp = positions.get(rootId) ?? { x: -ROOT_W / 2, y: -ROOT_H / 2 };
    const rootBox: Box = { x: rp.x + ROOT_W / 2, y: rp.y + ROOT_H / 2, w: ROOT_W, h: ROOT_H };
    const boxFor = (id: string) => (id === rootId ? rootBox : zoneBox.get(id));
    const routes = [...bundles]
      .filter((b) => !openBundles.has(b.id))
      .sort((a, b) => b.edges.length - a.edges.length || a.id.localeCompare(b.id))
      .flatMap((b) => {
        const s = boxFor(b.source);
        const t = boxFor(b.target);
        const fromRoot = b.from === "company" || b.to === "company";
        return s && t ? [{ id: b.id, route: routePath(s, t, 0, !fromRoot) }] : [];
      });
    const scale = Math.min(1 / zoomBucket, zoomBucket < 0.42 ? 3 : 1.8);
    return planLabels(routes, { w: 84 * scale, h: 30 * scale }, [{ ...rootBox, w: rootBox.w + 24, h: rootBox.h + 24 }]);
  }, [linkMode, zones, positions, rootId, bundles, openBundles, zoomBucket]);
  const familyTypes = useMemo(() => new Map([...types.values()].map((t) => [t.family as string, t])), [types]);

  const flowNodes = useMemo(() => {
    const out: Node[] = [];
    const hb = hoveredBundle ? bundles.find((b) => b.id === hoveredBundle) : undefined;
    const hotFamilies = new Set<string>(hb ? [hb.from, hb.to] : []);
    const visibleByFamily = new Map<string, number>();
    for (const n of nodes) if (n.tier === "overview") visibleByFamily.set(n.family, (visibleByFamily.get(n.family) ?? 0) + 1);
    const visibleFamilies = new Set(nodes.map((n) => n.family));
    const zoneOrder = new Map(zones.map((z, i) => [z.family as string, i]));
    const delay = (family: string) => (intro ? 80 + (zoneOrder.get(family) ?? 0) * 70 : 0);
    for (const z of zones) {
      if (!visibleFamilies.has(z.family)) continue;
      out.push({
        style: { ["--enter-delay" as string]: `${delay(z.family)}ms` },
        id: zoneNodeId(z.family),
        type: "zone",
        position: { x: z.x, y: z.y },
        width: z.w,
        height: z.h,
        draggable: false,
        selectable: false,
        focusable: false,
        zIndex: -1,
        className: "ox-rf-zone",
        data: {
          family: z.family,
          label: z.label,
          count: z.count,
          visible: visibleByFamily.get(z.family) ?? 0,
          glyph: familyTypes.get(z.family)?.glyph ?? "",
          dim: emphasis.active,
          hot: hotFamilies.has(z.family),
          compact,
        },
      });
    }
    for (const n of nodes) {
      const isRoot = n.id === rootId;
      const type = types.get(n.typeId);
      const em: Emphasis =
        n.id === selectedNode ? "selected" : !emphasis.active ? "normal" : emphasis.focusNodes.has(n.id) ? "near" : "dim";
      out.push({
        id: n.id,
        type: "entity",
        position: positions.get(n.id) ?? { x: 0, y: 0 },
        width: isRoot ? ROOT_W : NODE_W,
        height: isRoot ? ROOT_H : NODE_H,
        selected: n.id === selectedNode,
        hidden: compact && !isRoot && n.tier === "overview" && n.id !== selectedNode,
        zIndex: em === "selected" || em === "near" ? 3 : 1,
        ariaLabel: `${n.label}, ${type?.label ?? n.typeId}. ${n.degree} links.`,
        style: { ["--enter-delay" as string]: `${isRoot ? 0 : delay(n.family) + 60}ms` },
        className: `fam-${n.family}`,
        data: {
          entity: n,
          glyph: type?.glyph ?? "",
          typeLabel: type?.label ?? n.typeId,
          isRoot,
          emphasis: em,
          hovered: hovered === n.id,
          hiddenLinks: hiddenLinks.get(n.id) ?? 0,
          pathStep: pathIds.length > 1 && pathSet.has(n.id) ? pathIds.indexOf(n.id) + 1 : null,
        },
      });
    }
    if (evidence) {
      const anchor = positions.get(evidence.anchorId);
      if (anchor) {
        const cx = anchor.x + NODE_W / 2;
        const cy = anchor.y + NODE_H / 2;
        const base = Math.atan2(cy, cx);
        const count = evidence.rows.length;
        evidence.rows.forEach((row, i) => {
          const angle = base + (i - (count - 1) / 2) * 0.32;
          out.push({
            id: `ev:${row.linkId}`,
            type: "evidence",
            position: { x: cx + Math.cos(angle) * 260 - 90, y: cy + Math.sin(angle) * 260 - 32 },
            width: 180,
            height: 64,
            draggable: false,
            zIndex: 6,
            ariaLabel: `Evidence record ${row.record.title}, ${row.stance}`,
            data: { row },
          });
        });
      }
    }
    return out;
  }, [nodes, zones, familyTypes, types, positions, rootId, selectedNode, hovered, emphasis, hiddenLinks, pathSet, pathIds, evidence, compact, hoveredBundle, bundles, intro]);

  const flowEdges = useMemo(() => {
    // Which individual links to draw: everything in "all" mode; otherwise only
    // links that can't bundle, links in opened bands, and the focused neighbourhood.
    const show = new Set<string>();
    if (linkMode === "all") {
      for (const e of edges) show.add(e.id);
    } else {
      for (const id of looseEdges) show.add(id);
      for (const b of bundles) if (openBundles.has(b.id)) for (const e of b.edges) show.add(e.id);
      for (const id of emphasis.focusEdges) show.add(id);
      for (const id of pathEdges) show.add(id);
    }
    const pairCount = new Map<string, number>();
    const out: Edge[] = [];
    for (const e of edges) {
      if (!show.has(e.id)) continue;
      const key = [e.subjectId, e.objectId].sort().join("|");
      const idx = pairCount.get(key) ?? 0;
      pairCount.set(key, idx + 1);
      const em: Emphasis =
        e.id === selectedEdge ? "selected" : !emphasis.active ? "normal" : emphasis.focusEdges.has(e.id) ? "near" : "dim";
      out.push({
        className: e.id === hoveredEdge ? "is-hovered" : undefined,
        id: e.id,
        source: e.subjectId,
        target: e.objectId,
        type: "claim",
        selected: e.id === selectedEdge,
        zIndex: em === "selected" || em === "near" ? 2 : 0,
        ariaLabel: `${e.label}, ${STATE_META[e.evidenceState].label}`,
        data: {
          edge: e,
          emphasis: em,
          fromRoot: e.subjectId === rootId || e.objectId === rootId,
          parallelIndex: idx,
          onPath: pathEdges.has(e.id),
        },
      });
    }
    if (linkMode === "bundled") {
      const familyLabel = (f: string) => (f === "company" ? "Wayam.ai" : (familyTypes.get(f)?.pluralLabel ?? f));
      for (const b of bundles) {
        if (openBundles.has(b.id)) continue;
        out.push({
          id: `bundle:${b.id}`,
          source: b.source,
          target: b.target,
          type: "bundle",
          selectable: false,
          focusable: false,
          zIndex: -1,
          data: {
            bundle: b,
            dim: emphasis.active || (!!hoveredBundle && hoveredBundle !== b.id),
            fromRoot: b.from === "company" || b.to === "company",
            labelT: labelPlan.get(b.id) ?? 0.5,
            maxScale: compact ? 3 : 1.8,
            familyLabel,
          },
        });
      }
    }
    if (evidence) {
      for (const row of evidence.rows) {
        out.push({
          id: `evl:${row.linkId}`,
          source: `ev:${row.linkId}`,
          target: evidence.anchorId,
          type: "evidenceLink",
          selectable: false,
          focusable: false,
          data: { stance: row.stance },
        });
      }
    }
    return out;
  }, [edges, linkMode, looseEdges, bundles, openBundles, emphasis, selectedEdge, rootId, familyTypes, evidence, labelPlan, pathEdges, compact, hoveredEdge, hoveredBundle]);

  // After filters change, frame what's left instead of leaving a mostly empty view.
  const lastFit = useRef(fitKey);
  useEffect(() => {
    if (fitKey === lastFit.current) return;
    lastFit.current = fitKey;
    const ids = nodes.map((n) => n.id);
    if (!ids.length) return;
    const t = setTimeout(() => {
      void rf.fitView({ nodes: ids.map((id) => ({ id })), padding: FIT_PADDING, maxZoom: 1.1, duration: reducedMotion ? 0 : 400 });
    }, 60);
    return () => clearTimeout(t);
  }, [fitKey, nodes, rf, reducedMotion, FIT_PADDING]);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      for (const c of changes) {
        if (c.type === "position" && c.position && !c.id.startsWith("zone:") && !c.id.startsWith("ev:")) onMove(c.id, c.position);
      }
    },
    [onMove],
  );

  // Centre on explicit focus requests only (search, inspector hops) — never on
  // every selection, so the canvas doesn't jump while someone inspects.
  const lastFocus = useRef<number | null>(null);
  useEffect(() => {
    if (!focusRequest || focusRequest.nonce === lastFocus.current) return;
    const ids = focusRequest.ids.filter((id) => positions.has(id));
    if (!ids.length) return;
    // Wait a frame so panels that open with the selection (e.g. the evidence
    // sheet) have resized the canvas before framing.
    const t = setTimeout(() => {
      lastFocus.current = focusRequest.nonce;
      void rf.fitView({ nodes: ids.map((id) => ({ id })), padding: 0.35, maxZoom: 1.1, minZoom: 0.35, duration: reducedMotion ? 0 : 450 });
    }, 60);
    return () => clearTimeout(t);
  }, [focusRequest, positions, rf, reducedMotion]);

  // Arrow keys move focus to the nearest entity in that direction; Shift+arrows
  // keep React Flow's behaviour of moving the node itself.
  const onKeyDownCapture = useCallback(
    (ev: KeyboardEvent<HTMLDivElement>) => {
      const dirs: Record<string, [number, number]> = { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowDown: [0, 1], ArrowUp: [0, -1] };
      const dir = dirs[ev.key];
      if (!dir || ev.shiftKey || ev.altKey || ev.metaKey || ev.ctrlKey) return;
      const el = (ev.target as HTMLElement).closest?.(".react-flow__node") as HTMLElement | null;
      const from = el?.dataset.id;
      if (!from || from.startsWith("zone:") || from.startsWith("ev:")) return;
      ev.preventDefault();
      ev.stopPropagation();
      const centre = (id: string) => {
        const p = positions.get(id);
        if (!p) return null;
        const w = id === rootId ? ROOT_W : NODE_W;
        const h = id === rootId ? ROOT_H : NODE_H;
        return { x: p.x + w / 2, y: p.y + h / 2 };
      };
      const a = centre(from);
      if (!a) return;
      let best: { id: string; score: number } | null = null;
      for (const n of nodes) {
        if (n.id === from) continue;
        const b = centre(n.id);
        if (!b) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const along = dx * dir[0] + dy * dir[1];
        if (along <= 1) continue;
        const across = Math.abs(dx * dir[1] - dy * dir[0]);
        // Prefer nodes straight ahead: sideways distance costs more than distance ahead.
        const score = along + across * 2.2;
        if (!best || score < best.score) best = { id: n.id, score };
      }
      if (!best) return;
      const target = document.querySelector<HTMLElement>(`.react-flow__node[data-id="${CSS.escape(best.id)}"]`);
      target?.focus({ preventScroll: true });
      const c = centre(best.id)!;
      const { x, y, zoom } = rf.getViewport();
      const box = target?.closest(".react-flow")?.getBoundingClientRect();
      if (box) {
        const sx = c.x * zoom + x;
        const sy = c.y * zoom + y;
        const margin = 80;
        if (sx < margin || sy < margin || sx > box.width - margin || sy > box.height - margin) {
          void rf.setCenter(c.x, c.y, { zoom, duration: reducedMotion ? 0 : 250 });
        }
      }
    },
    [nodes, positions, rootId, rf, reducedMotion],
  );

  const frameSelection = useCallback(() => {
    const ids = [...emphasis.focusNodes].filter((id) => positions.has(id));
    if (!ids.length) return;
    void rf.fitView({ nodes: ids.map((id) => ({ id })), padding: FIT_PADDING, maxZoom: 1.2, duration: reducedMotion ? 0 : 400 });
  }, [emphasis, positions, rf, FIT_PADDING, reducedMotion]);

  // "F" frames the selection from anywhere on the page (not while typing).
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== "f" && e.key !== "F") return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea, select, [contenteditable]") || document.querySelector("dialog[open], .ox-menu")) return;
      e.preventDefault();
      frameSelection();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [frameSelection]);

  const onKeyDown = useCallback(
    (ev: KeyboardEvent<HTMLDivElement>) => {
      const el = ev.target as HTMLElement;
      const node = el.closest?.(".react-flow__node") as HTMLElement | null;
      const edge = el.closest?.(".react-flow__edge") as HTMLElement | null;
      const id = node?.dataset.id ?? edge?.dataset.id;
      if (!id || id.startsWith("zone:") || id.startsWith("bundle:")) return;
      if (node && !id.startsWith("ev:") && (ev.key === "ContextMenu" || (ev.shiftKey && ev.key === "F10"))) {
        ev.preventDefault();
        const r = node.getBoundingClientRect();
        setMenu({ id, x: r.left + 12, y: r.bottom + 4 });
        return;
      }
      if (ev.key === "Enter" || ev.key === " ") {
        ev.preventDefault();
        if (id.startsWith("ev:")) return;
        if (node) actions.selectNode(id);
        else actions.selectEdge(id);
      } else if ((ev.key === "+" || ev.key === "=") && node) {
        ev.preventDefault();
        onExpand(id);
      }
    },
    [actions, onExpand],
  );

  return (
    <div className={`ox-canvas ox-canvas--${linkMode}${intro ? " is-intro" : ""}`} onKeyDown={onKeyDown} onKeyDownCapture={onKeyDownCapture}>
      <EdgeMarkers />
      <ReactFlow
        nodes={flowNodes}
        edges={flowEdges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onNodeClick={(_, n) => {
          if (n.type === "entity") actions.selectNode(n.id);
        }}
        onNodeDoubleClick={(_, n) => {
          if (n.type === "entity") onExpand(n.id);
        }}
        onEdgeClick={(_, e) => {
          if (e.type === "claim") actions.selectEdge(e.id);
          else if (e.type === "bundle") actions.toggleBundle(e.id.slice("bundle:".length));
        }}
        onNodeContextMenu={(e, n) => {
          if (n.type !== "entity") return;
          e.preventDefault();
          onHover(null);
          setMenu({ id: n.id, x: e.clientX, y: e.clientY });
        }}
        onEdgeMouseEnter={(_, e) => e.type === "claim" && setHoveredEdge(e.id)}
        onEdgeMouseLeave={() => setHoveredEdge(null)}
        onNodeMouseEnter={(_, n) => n.type === "entity" && onHover(n.id)}
        onNodeMouseLeave={() => onHover(null)}
        onPaneClick={onClear}
        fitView
        fitViewOptions={{ padding: FIT_PADDING }}
        onInit={(inst) => {
          // Re-fit once fonts and panels have settled so the whole overview is in view.
          if (!selectedNode && !selectedEdge) setTimeout(() => void inst.fitView({ padding: FIT_PADDING }), 120);
        }}
        minZoom={0.2}
        maxZoom={2.2}
        zoomOnDoubleClick={false}
        nodesConnectable={false}
        elementsSelectable
        nodesFocusable
        edgesFocusable
        proOptions={{ hideAttribution: true }}
        ariaLabelConfig={{
          "node.a11yDescription.default": "Press Enter to inspect, plus to expand neighbours. Arrow keys move the node.",
          "edge.a11yDescription.default": "Press Enter to inspect this relationship and its evidence.",
        }}
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={1.1} color="var(--canvas-dot)" />
        <Panel position="top-left" className="ox-panel-reset ox-topbar">
          <Legend linkMode={linkModeLocked ? "all" : linkMode} />
          {topBarExtra}
        </Panel>
        {compact && (
          <Panel position="bottom-center" className="ox-panel-reset">
            <p className="ox-zoomhint">Zoomed out: families shown as blocks. Zoom in to see each entity.</p>
          </Panel>
        )}
        <Panel position="bottom-left" className="ox-panel-reset">
          <Toolbar
            linkMode={linkMode}
            locked={linkModeLocked}
            openCount={openBundles.size}
            showMap={showMap}
            reducedMotion={reducedMotion}
            onLinkMode={onLinkMode}
            fitPad={FIT_PADDING}
            canFrame={!!(selectedNode || selectedEdge)}
            onFrame={frameSelection}
            onToggleMap={() => setShowMap((v) => !v)}
            onHelp={onHelp}
          />
        </Panel>
        {showMap && (
          <MiniMap
            position="bottom-right"
            pannable
            zoomable
            ariaLabel="Overview of the whole graph"
            nodeClassName={(n) => (n.type === "zone" ? `ox-mm-zone ${String(n.id).replace("zone:", "fam-")}` : `ox-mm-node ${n.className ?? ""}`)}
            nodeBorderRadius={6}
            bgColor="var(--surface)"
          />
        )}
      </ReactFlow>
      {menu && (
        <NodeMenu
          x={menu.x}
          y={menu.y}
          title={nodes.find((n) => n.id === menu.id)?.label ?? menu.id}
          onAction={(a) => onMenuAction(a, menu.id)}
          onClose={closeMenu}
        />
      )}
    </div>
  );
}

function Toolbar({
  linkMode,
  locked,
  openCount,
  showMap,
  reducedMotion,
  fitPad,
  canFrame,
  onFrame,
  onLinkMode,
  onToggleMap,
  onHelp,
}: {
  linkMode: LinkMode;
  locked: boolean;
  openCount: number;
  showMap: boolean;
  reducedMotion: boolean;
  fitPad: ReturnType<typeof fitPadding>;
  canFrame: boolean;
  onFrame: () => void;
  onLinkMode: (m: LinkMode) => void;
  onToggleMap: () => void;
  onHelp: () => void;
}) {
  const { zoomIn, zoomOut, fitView } = useReactFlow();
  const zoom = useStore(zoomSelector);
  const duration = reducedMotion ? 0 : 200;
  return (
    <div className="ox-toolbar">
      <div className="ox-toolbar__group" role="group" aria-label="Zoom">
        <button type="button" className="ox-tool" onClick={() => void zoomOut({ duration })} aria-label="Zoom out" title="Zoom out">
          <Icon name="minus" />
        </button>
        <span className="ox-toolbar__zoom">{Math.round(zoom * 100)}%</span>
        <button type="button" className="ox-tool" onClick={() => void zoomIn({ duration })} aria-label="Zoom in" title="Zoom in">
          <Icon name="plus" />
        </button>
        <button
          type="button"
          className="ox-tool"
          onClick={() => void fitView({ padding: fitPad, duration: reducedMotion ? 0 : 350 })}
          aria-label="Fit the whole graph"
          title="Fit the whole graph"
        >
          <Icon name="fit" />
        </button>
        <button
          type="button"
          className="ox-tool"
          onClick={onFrame}
          disabled={!canFrame}
          aria-label="Frame the selection"
          title="Frame the selection (F)"
        >
          <Icon name="focus" />
        </button>
      </div>
      <div className="ox-toolbar__group">
        <Segmented
          label="Link display"
          size="s"
          value={locked ? "all" : linkMode}
          onChange={(v) => onLinkMode(v)}
          options={[
            { value: "bundled", label: "Grouped", icon: <Icon name="bundle" size={14} />, title: "One band per pair of families" },
            { value: "all", label: "All links", icon: <Icon name="lines" size={14} />, title: "Draw every relationship" },
          ]}
        />
        {locked && <span className="ox-toolbar__note">Filters on, every link shown</span>}
        {!locked && linkMode === "bundled" && openCount > 0 && (
          <button type="button" className="ox-toolbar__link" onClick={() => onLinkMode("bundled")}>
            Regroup {openCount} opened
          </button>
        )}
      </div>
      <button
        type="button"
        className="ox-tool ox-tool--solo"
        aria-pressed={showMap}
        onClick={onToggleMap}
        aria-label={showMap ? "Hide minimap" : "Show minimap"}
        title={showMap ? "Hide minimap" : "Show minimap"}
      >
        <Icon name="map" />
      </button>
      <button type="button" className="ox-tool ox-tool--solo" onClick={onHelp} aria-label="Keyboard shortcuts and tips" title="Shortcuts (?)">
        <span className="ox-tool__q" aria-hidden="true">?</span>
      </button>
    </div>
  );
}

function Legend({ linkMode }: { linkMode: LinkMode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`ox-legend${open ? " is-open" : ""}`} role="group" aria-label="Link legend">
      <button type="button" className="ox-legend__toggle" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        Key
      </button>
      {linkMode === "bundled" && (
        <span className="ox-legend__item">
          <span className="ox-legend__band" aria-hidden="true" />
          Grouped links, click to open
        </span>
      )}
      {(["linked", "none", "disputed"] as const).map((s) => (
        <span key={s} className="ox-legend__item">
          <svg width="26" height="8" aria-hidden="true">
            <line x1="0" y1="4" x2="26" y2="4" className={`ox-legend__line ox-edge--${s}`} />
          </svg>
          <span aria-hidden="true">{STATE_META[s].glyph}</span> {STATE_META[s].label}
        </span>
      ))}
    </div>
  );
}
