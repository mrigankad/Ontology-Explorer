"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createHttpAdapter, type OntologyDataAdapter } from "@/lib/ontology/client";
import {
  applyFilters,
  bundleEdges,
  compactZones,
  edgeBetween,
  emptyGraph,
  mergeGraph,
  collapseBranch,
  overviewLayout,
  placeAround,
  shortestPath,
  type GraphData,
  type Point,
} from "@/lib/ontology/graph-model";
import type {
  ClaimSummary,
  EvidenceRow,
  NeighborsResponse,
  OverviewResponse,
  Page,
  ViewerRole,
} from "@/lib/ontology/types";
import { formatTrailReport, reportFilename, type TrailHop } from "@/lib/ontology/report";
import { nextPath } from "@/lib/ontology/url-state";
import { EdgeInspector } from "./EdgeInspector";
import { IconSetContext } from "./EntityIcon";
import { EvidenceSheet, type EvidenceFilters } from "./EvidenceSheet";
import { FilterRail } from "./FilterRail";
import { GraphCanvas } from "./graph/GraphCanvas";
import { useExplorerUrl, useOnline, usePrefersReducedMotion, useResource } from "./hooks";
import { ListView, SchemaView } from "./ListView";
import { NodeInspector, type ExpandOptions, type ExpansionInfo } from "./NodeInspector";
import { PathTrail } from "./PathTrail";
import { RecordViewer, type RecordNav } from "./RecordViewer";
import { SearchBox } from "./SearchBox";
import { FirstRunTip, HelpDialog, PathFinder } from "./Assist";
import { FilterChips, Toasts, pushRecent, useRecent, useToasts, type RecentItem } from "./Feedback";
import { CommandBar, type Command } from "./CommandBar";
import { Icon, Select, Segmented, ThemeToggle, toggleTheme, followSystemTheme } from "./controls";
import type { MenuAction } from "./graph/NodeMenu";
import { DemoBadge, STATE_META, familyVars } from "./ui";

export interface OntologyExplorerProps {
  /** Bounded overview fetched on the server for a fast first paint. */
  initial: OverviewResponse;
  /** Data source. Defaults to the HTTP adapter for /api/ontology. */
  adapter?: OntologyDataAdapter;
  viewerRole: ViewerRole;
  /** Generated icons available in public/icons. */
  iconKeys?: string[];
}

interface Model {
  graph: GraphData;
  positions: Map<string, Point>;
}

type Expansion = ExpansionInfo & { cursor: string | null; opts: ExpandOptions };
const DEFAULT_EXPAND: ExpandOptions = { direction: "both", relation: "", depth: 1 };

export function OntologyExplorer({ initial, adapter: adapterProp, viewerRole, iconKeys }: OntologyExplorerProps) {
  const iconSet = useMemo(() => new Set(iconKeys ?? []), [iconKeys]);
  const adapter = useMemo(() => adapterProp ?? createHttpAdapter(), [adapterProp]);
  const [url, update] = useExplorerUrl();
  const rootId = initial.rootId;
  const types = useMemo(() => new Map(initial.types.map((t) => [t.id, t])), [initial.types]);
  const layout = useMemo(
    () => overviewLayout(initial.nodes, initial.types, rootId, initial.edges),
    [initial.nodes, initial.types, rootId, initial.edges],
  );

  // Domain data (fetched) + display positions. Kept in a ref mirror so async
  // loaders can compute the next model without stale closures.
  const [model, setModel] = useState<Model>(() => ({
    graph: mergeGraph(emptyGraph(), initial.nodes, initial.edges),
    positions: layout.positions,
  }));
  const modelRef = useRef(model);
  const commit = useCallback((next: Model) => {
    modelRef.current = next;
    setModel(next);
  }, []);

  const [expansions, setExpansions] = useState<Record<string, Expansion>>({});
  const [hovered, setHovered] = useState<string | null>(null);
  const [openBundles, setOpenBundles] = useState<Set<string>>(() => new Set());
  const [helpOpen, setHelpOpen] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [pathFinder, setPathFinder] = useState<{ from: string; busy: boolean; error: string | null } | null>(null);
  const [focusRequest, setFocusRequest] = useState<{ ids: string[]; nonce: number } | null>(null);
  const { toasts, notify, dismiss } = useToasts();
  const [railOpen, setRailOpen] = useState(false);
  const [railCollapsed, setRailCollapsed] = useState(false);
  const [copied, setCopied] = useState(false);
  const notifyRef = useRef(notify);
  const collapseRef = useRef<(id: string) => void>(() => {});
  useEffect(() => {
    notifyRef.current = notify;
  });
  const online = useOnline();
  const reducedMotion = usePrefersReducedMotion();
  const searchRef = useRef<HTMLInputElement>(null);

  // ---------------------------------------------------------------------------
  // Loading neighbourhoods
  // ---------------------------------------------------------------------------

  const mergeResponse = useCallback(
    (res: NeighborsResponse, anchorId: string) => {
      const m = modelRef.current;
      const anchor = m.positions.has(anchorId) ? anchorId : (res.nodes.find((n) => m.positions.has(n.id))?.id ?? rootId);
      const graph = mergeGraph(m.graph, res.nodes, res.edges, anchor);
      const fresh = res.nodes.map((n) => n.id).filter((id) => !m.positions.has(id));
      const positions = fresh.length ? placeAround(m.positions.get(anchor) ?? { x: 0, y: 0 }, fresh, m.positions, layout.zones) : m.positions;
      commit({ graph, positions });
    },
    [commit, rootId, layout.zones],
  );

  const ensureNode = useCallback(
    async (id: string) => {
      if (modelRef.current.graph.nodes.has(id)) return true;
      try {
        mergeResponse(await adapter.neighbors(id, { depth: 1, limit: 24 }), id);
        return true;
      } catch (e) {
        notifyRef.current(`Couldn’t load ${id}: ${(e as Error).message}`);
        return false;
      }
    },
    [adapter, mergeResponse],
  );

  const ensureEdge = useCallback(
    async (id: string) => {
      const known = modelRef.current.graph.edges.get(id);
      if (known) return known.subjectId;
      try {
        const rel = await adapter.relationship(id);
        await ensureNode(rel.subjectId);
        await ensureNode(rel.objectId);
        if (!modelRef.current.graph.edges.has(id)) {
          const m = modelRef.current;
          commit({ ...m, graph: mergeGraph(m.graph, [], [rel]) });
        }
        return rel.subjectId;
      } catch (e) {
        notifyRef.current(`Couldn’t load relationship ${id}: ${(e as Error).message}`);
        return null;
      }
    },
    [adapter, commit, ensureNode],
  );

  // Fetch + merge a neighbourhood page. State updates happen only in callbacks.
  const runExpand = useCallback(
    (id: string, opts: ExpandOptions, cursor: string | null, more: boolean) =>
      adapter
        .neighbors(id, {
          direction: opts.direction,
          relations: opts.relation ? [opts.relation] : undefined,
          depth: opts.depth,
          cursor,
          limit: 12,
        })
        .then((res) => {
          mergeResponse(res, id);
          setExpansions((e) => ({
            ...e,
            [id]: {
              loaded: (more ? (e[id]?.loaded ?? 0) : 0) + res.edges.length,
              total: res.total,
              hasMore: !!res.nextCursor,
              cursor: res.nextCursor,
              loading: false,
              error: null,
              opts,
            },
          }));
          update((s) => ({ expanded: s.expanded.includes(id) ? s.expanded : [...s.expanded, id] }));
          const label = modelRef.current.graph.nodes.get(id)?.label ?? id;
          notifyRef.current(
            res.edges.length ? `Loaded ${res.edges.length} of ${res.total} links around ${label}` : `${label} has no more links to load`,
            res.edges.length ? { label: "Collapse", run: () => collapseRef.current(id) } : undefined,
          );
        })
        .catch((err: Error) => {
          notifyRef.current(`Couldn’t load neighbours: ${err.message}`);
          setExpansions((e) => ({
            ...e,
            [id]: { ...(e[id] ?? { loaded: 0, total: 0, hasMore: false, cursor: null, opts }), loading: false, error: `Expansion failed: ${err.message}` },
          }));
        }),
    [adapter, mergeResponse, update],
  );

  const expand = useCallback(
    (id: string, opts: ExpandOptions, more: boolean) => {
      const cursor = more ? (expansions[id]?.cursor ?? null) : null;
      setExpansions((e) => ({
        ...e,
        [id]: { ...(e[id] ?? { loaded: 0, total: 0, hasMore: false, cursor: null }), opts, loading: true, error: null },
      }));
      void runExpand(id, opts, cursor, more);
    },
    [expansions, runExpand],
  );

  const collapse = useCallback(
    (id: string) => {
      const m = modelRef.current;
      const protect = new Set([...url.path, url.node ?? "", rootId]);
      commit({ ...m, graph: collapseBranch(m.graph, id, protect) });
      setExpansions((e) => {
        const next = { ...e };
        delete next[id];
        return next;
      });
      update((s) => ({ expanded: s.expanded.filter((x) => x !== id) }));
    },
    [commit, rootId, update, url.node, url.path],
  );

  useEffect(() => {
    collapseRef.current = collapse;
  });

  // Restore expansions and deep-linked selections once on load.
  const restored = useRef(false);
  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    // Deferred so all loading happens in callbacks, not during the effect itself.
    queueMicrotask(() => {
      for (const id of url.expanded) void runExpand(id, DEFAULT_EXPAND, null, false);
      if (url.node) void ensureNode(url.node);
      if (url.edge) void ensureEdge(url.edge);
    });
  }, [url.expanded, url.node, url.edge, runExpand, ensureNode, ensureEdge]);

  // ---------------------------------------------------------------------------
  // Selection + navigation (all URL-backed)
  // ---------------------------------------------------------------------------

  const adjacent = useCallback((a: string, b: string) => !!edgeBetween(modelRef.current.graph, a, b), []);
  const rootPath = useCallback((id: string) => shortestPath(modelRef.current.graph, rootId, id), [rootId]);

  const selectNode = useCallback(
    async (id: string, how: "canvas" | "hop" | "search" | "crumb" = "canvas") => {
      await ensureNode(id);
      update(
        (s) => ({
          node: id,
          edge: null,
          record: null,
          ev: null,
          path: how === "search" ? rootPath(id) : nextPath(s.path.length ? s.path : [rootId], id, adjacent, rootPath),
        }),
        "push",
      );
      if (how === "search" || how === "hop") setFocusRequest({ ids: [id], nonce: Date.now() });
    },
    [adjacent, ensureNode, rootId, rootPath, update],
  );

  const selectEdge = useCallback(
    async (id: string, keepEvidence = false, focus = true) => {
      const subject = await ensureEdge(id);
      if (!subject) return;
      const e = modelRef.current.graph.edges.get(id);
      if (focus && e) setFocusRequest({ ids: [e.subjectId, e.objectId], nonce: Date.now() });
      update(
        (s) => ({
          edge: id,
          node: null,
          record: null,
          ev: keepEvidence ? { kind: "rel", id } : s.ev?.kind === "rel" && s.ev.id === id ? s.ev : null,
          path: nextPath(s.path.length ? s.path : [rootId], subject, adjacent, rootPath),
        }),
        "push",
      );
    },
    [adjacent, ensureEdge, rootId, rootPath, update],
  );

  const openEvidence = useCallback(
    (target: { kind: "rel" | "ent"; id: string }) =>
      update({ ev: target, evQuery: "", evKind: null, evStance: null, evSource: null, evFrom: null, evTo: null, record: null }, "push"),
    [update],
  );
  const openRecord = useCallback((id: string) => update({ record: id }, "push"), [update]);
  const closeRecord = useCallback(() => update({ record: null }, "push"), [update]);
  const clearSelection = useCallback(() => update({ node: null, edge: null, isolate: false, ev: null }, "push"), [update]);

  const showClaim = useCallback(
    (claim: ClaimSummary) => {
      if (claim.kind === "relationship") void selectEdge(claim.id, true);
      else void selectNode(claim.id, "hop");
    },
    [selectEdge, selectNode],
  );

  const toggleBundle = useCallback((id: string) => {
    setOpenBundles((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const canvasActions = useMemo(
    () => ({
      selectNode: (id: string) => void selectNode(id),
      selectEdge: (id: string) => void selectEdge(id, false, false),
      openRecord,
      toggleBundle,
      expand: (id: string) => expand(id, DEFAULT_EXPAND, false),
    }),
    [selectNode, selectEdge, openRecord, toggleBundle, expand],
  );

  // "How is A connected to B?" Shortest chain over the loaded graph; if the two
  // are not connected yet, load both two-hop neighbourhoods once and retry.
  const findPath = useCallback(
    async (from: string, to: string) => {
      setPathFinder((p) => (p ? { ...p, busy: true, error: null } : p));
      await ensureNode(to);
      let p = shortestPath(modelRef.current.graph, from, to);
      if (p.length < 2 && from !== to) {
        try {
          const [a, b] = await Promise.all([
            adapter.neighbors(from, { depth: 2, limit: 50 }),
            adapter.neighbors(to, { depth: 2, limit: 50 }),
          ]);
          mergeResponse(a, from);
          mergeResponse(b, to);
          p = shortestPath(modelRef.current.graph, from, to);
        } catch {
          // Fall through to the "no connection" message.
        }
      }
      const label = (id: string) => modelRef.current.graph.nodes.get(id)?.label ?? id;
      if (p.length < 2) {
        setPathFinder((st) =>
          st ? { ...st, busy: false, error: `No connection found between ${label(from)} and ${label(to)} within the loaded graph.` } : st,
        );
        return;
      }
      update((st) => ({ path: p, node: to, edge: null, record: null, ev: null, hidden: st.hidden.filter((h) => !p.includes(h)) }), "push");
      setFocusRequest({ ids: p, nonce: Date.now() });
      setPathFinder(null);
      notify(`Path found: ${p.map(label).join(" → ")} (${p.length - 1} ${p.length === 2 ? "hop" : "hops"})`, {
        label: "Clear path",
        run: () => update({ path: [to] }),
      });
    },
    [adapter, ensureNode, mergeResponse, notify, update],
  );

  const onMenuAction = useCallback(
    (action: MenuAction, id: string) => {
      switch (action) {
        case "inspect":
          void selectNode(id, "hop");
          break;
        case "expand":
          expand(id, DEFAULT_EXPAND, false);
          break;
        case "isolate":
          void selectNode(id, "hop").then(() => update({ isolate: true }));
          break;
        case "evidence":
          void selectNode(id, "hop").then(() => update({ ev: { kind: "ent", id } }, "push"));
          break;
        case "path":
          setPathFinder({ from: id, busy: false, error: null });
          break;
        case "copy": {
          const u = new URL(window.location.href);
          u.search = `?node=${encodeURIComponent(id)}`;
          void navigator.clipboard?.writeText(u.toString()).then(
            () => notify(`Link to ${modelRef.current.graph.nodes.get(id)?.label ?? id} copied`),
            () => notify("Copying failed. Copy the address bar instead."),
          );
          break;
        }
        case "hide":
          update(
            (st) => ({
              hidden: st.hidden.includes(id) ? st.hidden : [...st.hidden, id],
              node: st.node === id ? null : st.node,
              path: st.path.filter((x) => x !== id),
            }),
            "push",
          );
          notify(`${modelRef.current.graph.nodes.get(id)?.label ?? id} hidden from the canvas`, {
            label: "Undo",
            run: () => update((st) => ({ hidden: st.hidden.filter((x) => x !== id) })),
          });
          break;
      }
    },
    [expand, notify, selectNode, update],
  );

  // Keyboard: "/" focuses search, Escape steps back out of the deepest layer.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      const typing = el.closest("input, textarea, select, [contenteditable]");
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCmdOpen((o) => !o);
        return;
      }
      // Dialogs and menus handle their own keys.
      if (document.querySelector("dialog[open], .ox-menu")) return;
      if (e.key === "/" && !typing) {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (e.key === "?" && !typing) {
        e.preventDefault();
        setHelpOpen(true);
      } else if (e.key === "Escape" && !typing) {
        if (url.record) closeRecord();
        else if (url.ev) update({ ev: null }, "push");
        else if (url.node || url.edge) clearSelection();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [url.record, url.ev, url.node, url.edge, closeRecord, clearSelection, update]);

  // ---------------------------------------------------------------------------
  // Derived view state
  // ---------------------------------------------------------------------------

  const filter = useMemo(
    () =>
      applyFilters(model.graph, {
        rootId,
        hideFamilies: url.hideFamilies,
        rels: url.rels,
        states: url.states,
        focus: url.focus,
        isolate: url.isolate ? url.node : null,
        hidden: url.hidden,
      }),
    [model.graph, rootId, url.hideFamilies, url.rels, url.states, url.focus, url.isolate, url.node, url.hidden],
  );

  const visibleNodes = useMemo(() => [...model.graph.nodes.values()].filter((n) => filter.nodeIds.has(n.id)), [model.graph, filter]);
  const visibleEdges = useMemo(() => [...model.graph.edges.values()].filter((e) => filter.edgeIds.has(e.id)), [model.graph, filter]);

  const nodeMap = useMemo(() => new Map(visibleNodes.map((n) => [n.id, n])), [visibleNodes]);
  const { bundles, loose } = useMemo(() => bundleEdges(visibleEdges, nodeMap, rootId), [visibleEdges, nodeMap, rootId]);
  // Relation/evidence filters and focus modes ask about specific links, so draw them all.
  const linkModeLocked = url.rels.length > 0 || url.states.length > 0 || url.isolate || !!url.focus;
  const linkMode = linkModeLocked ? "all" : url.links;

  // "+N" counts links that exist but aren't loaded yet (clicking loads them).
  // Links hidden by filters are reported in the filter rail instead.
  const hiddenLinks = useMemo(() => {
    const loaded = new Map<string, number>();
    for (const e of model.graph.edges.values()) {
      loaded.set(e.subjectId, (loaded.get(e.subjectId) ?? 0) + 1);
      loaded.set(e.objectId, (loaded.get(e.objectId) ?? 0) + 1);
    }
    return new Map(visibleNodes.map((n) => [n.id, Math.max(0, n.degree - (loaded.get(n.id) ?? 0))]));
  }, [visibleNodes, model.graph]);

  const filtersActive = filter.hiddenNodes > 0;
  const display = useMemo(
    () => (filtersActive ? compactZones(model.positions, layout.zones, visibleNodes) : { positions: model.positions, zones: layout.zones }),
    [filtersActive, model.positions, layout.zones, visibleNodes],
  );

  const selectedEdge = url.edge ? (model.graph.edges.get(url.edge) ?? null) : null;

  const evidenceAnchor = url.evidenceNodes ? (url.node ?? selectedEdge?.objectId ?? null) : null;
  const evTarget = url.node ? `entityId=${url.node}` : url.edge ? `relationshipId=${url.edge}` : null;
  const canvasEvidence = useResource<Page<EvidenceRow>>(url.evidenceNodes && evTarget ? `canvas-ev:${evTarget}` : null, (s) =>
    adapter.evidence(url.node ? { entityId: url.node, limit: 6 } : { relationshipId: url.edge!, limit: 6 }, s),
  );

  const familyTotals = initial.familyCounts;
  const unloaded = Object.values(familyTotals).reduce((a, b) => a + b, 0) - model.graph.nodes.size;

  const liveText = useMemo(() => {
    if (url.edge && selectedEdge) {
      const s = model.graph.nodes.get(selectedEdge.subjectId)?.label;
      const o = model.graph.nodes.get(selectedEdge.objectId)?.label;
      return `Selected relationship: ${s} ${selectedEdge.label} ${o}. ${STATE_META[selectedEdge.evidenceState].label}.`;
    }
    if (url.node) {
      const n = model.graph.nodes.get(url.node);
      if (n) return `Selected ${n.label}, ${types.get(n.typeId)?.label}. ${n.degree} links.`;
    }
    return "";
  }, [url.edge, url.node, selectedEdge, model.graph, types]);

  const evFilters: EvidenceFilters = {
    query: url.evQuery,
    kind: url.evKind,
    stance: url.evStance,
    source: url.evSource,
    from: url.evFrom,
    to: url.evTo,
    sort: url.evSort,
  };
  const onEvFilters = useCallback(
    (f: Partial<EvidenceFilters>) => {
      const p: Parameters<typeof update>[0] = {};
      if ("query" in f) p.evQuery = f.query ?? "";
      if ("kind" in f) p.evKind = f.kind ?? null;
      if ("stance" in f) p.evStance = f.stance ?? null;
      if ("source" in f) p.evSource = f.source ?? null;
      if ("from" in f) p.evFrom = f.from ?? null;
      if ("to" in f) p.evTo = f.to ?? null;
      if ("sort" in f && f.sort) p.evSort = f.sort;
      update(p);
    },
    [update],
  );

  const evHeading = (() => {
    if (!url.ev) return null;
    if (url.ev.kind === "rel") {
      const e = model.graph.edges.get(url.ev.id);
      if (!e) return <span className="ox-mono">{url.ev.id}</span>;
      return (
        <span className="ox-sheet__triple">
          {model.graph.nodes.get(e.subjectId)?.label} <span className="ox-pred">{e.label}</span> {model.graph.nodes.get(e.objectId)?.label}
        </span>
      );
    }
    const n = model.graph.nodes.get(url.ev.id);
    return <span className="ox-sheet__triple">{n?.label ?? url.ev.id}, including its relationships</span>;
  })();

  // Step through the evidence table from inside the record viewer.
  const navQuery = url.ev
    ? {
        ...(url.ev.kind === "rel" ? { relationshipId: url.ev.id } : { entityId: url.ev.id }),
        query: url.evQuery || undefined,
        kind: url.evKind ?? undefined,
        stance: url.evStance ?? undefined,
        sourceId: url.evSource ?? undefined,
        from: url.evFrom ? `${url.evFrom}T00:00:00.000Z` : undefined,
        to: url.evTo ? `${url.evTo}T23:59:59.999Z` : undefined,
        sort: url.evSort,
        limit: 50,
      }
    : null;
  const navList = useResource<Page<EvidenceRow>>(url.record && navQuery ? `nav:${JSON.stringify(navQuery)}` : null, (s) =>
    adapter.evidence(navQuery!, s),
  );
  const recordNav = useMemo<RecordNav | null>(() => {
    if (!url.record || !navList.data) return null;
    const ids = [...new Set(navList.data.items.map((r) => r.record.id))];
    const i = ids.indexOf(url.record);
    if (i < 0) return null;
    return { index: i, total: ids.length, prev: ids[i - 1] ?? null, next: ids[i + 1] ?? null };
  }, [url.record, navList.data]);

  // Remember what this viewer looked at, for the welcome panel.
  useEffect(() => {
    const g = modelRef.current.graph;
    if (url.node && g.nodes.has(url.node)) pushRecent({ kind: "node", id: url.node, label: g.nodes.get(url.node)!.label });
    else if (url.edge && g.edges.has(url.edge)) {
      const e = g.edges.get(url.edge)!;
      pushRecent({ kind: "edge", id: e.id, label: `${g.nodes.get(e.subjectId)?.label} ${e.label} ${g.nodes.get(e.objectId)?.label}` });
    }
  }, [url.node, url.edge, model.graph]);

  const labelOf = useCallback((id: string) => model.graph.nodes.get(id)?.label ?? id, [model.graph]);
  const resetFilters = useCallback(
    () => update({ hideFamilies: [], rels: [], states: [], focus: null, isolate: false, evidenceNodes: false, hidden: [] }),
    [update],
  );
  // "Back" in the entity inspector walks one step back along the trail.
  const prevStep = url.node ? url.path[url.path.indexOf(url.node) - 1] : undefined;
  const nodeBack = useMemo(
    () => (prevStep ? { label: labelOf(prevStep), onClick: () => void selectNode(prevStep, "crumb") } : undefined),
    [prevStep, labelOf, selectNode],
  );
  const activeFilterCount =
    url.hideFamilies.length + (url.states.length ? 1 : 0) + (url.rels.length ? 1 : 0) + (url.focus ? 1 : 0) + (url.isolate ? 1 : 0) + (url.hidden.length ? 1 : 0);

  // Download the current trail, hop by hop, with the evidence behind each link.
  const exportTrail = useCallback(async () => {
    const path = url.path;
    if (path.length < 2) return;
    setExporting(true);
    try {
      const g = modelRef.current.graph;
      const label = (id: string) => g.nodes.get(id)?.label ?? id;
      const hops: TrailHop[] = await Promise.all(
        path.slice(1).map(async (to, i) => {
          const from = path[i];
          const e = edgeBetween(g, from, to);
          if (!e) return { from: label(from), to: label(to), relationship: null, evidence: [] };
          const [relationship, ev] = await Promise.all([adapter.relationship(e.id), adapter.evidence({ relationshipId: e.id, limit: 50 })]);
          return { from: label(from), to: label(to), relationship, evidence: ev.items };
        }),
      );
      const labels = path.map(label);
      const md = formatTrailReport({
        labels,
        hops,
        datasetLabel: initial.dataset.label,
        isDemo: initial.dataset.isDemo,
        viewUrl: window.location.href,
        recordUrl: (id) => `${window.location.origin}/records/${encodeURIComponent(id)}`,
        exportedAt: new Date(),
      });
      const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = reportFilename(labels);
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      notify(`Trail exported: ${a.download}`);
    } catch (err) {
      notify(`Export failed: ${(err as Error).message}`);
    } finally {
      setExporting(false);
    }
  }, [adapter, initial.dataset.isDemo, initial.dataset.label, notify, url.path]);

  // Everything the command bar can do. Built from current state so it only
  // offers actions that make sense right now.
  const commands: Command[] = [
    { id: "path", label: "Find a path", hint: "Between any two entities", icon: "route", keywords: "connect route how between two entities", run: () => setPathFinder({ from: url.node ?? rootId, busy: false, error: null }) },
    ...(url.path.length > 1 ? [{ id: "export", label: "Export trail", hint: "Markdown report with evidence", icon: "download" as const, keywords: "download markdown share report", run: () => void exportTrail() }] : []),
    ...(url.node || url.edge ? [{ id: "clear", label: "Clear the selection", shortcut: "Esc", run: clearSelection }] : []),
    ...(url.node
      ? [
          { id: "expand", label: "Expand the selected entity’s neighbours", keywords: "load more", shortcut: "+", run: () => expand(url.node!, DEFAULT_EXPAND, false) },
          { id: "evidence", label: "Open evidence for the selection", keywords: "records table", run: () => openEvidence({ kind: "ent", id: url.node! }) },
        ]
      : []),
    ...(url.edge ? [{ id: "evidence", label: "Open evidence for the selection", keywords: "records table", run: () => openEvidence({ kind: "rel", id: url.edge! }) }] : []),
    url.links === "all"
      ? { id: "links", label: "Group links between families", keywords: "bundle bands tidy", run: () => update({ links: "bundled" }) }
      : { id: "links", label: "Show every individual link", keywords: "all lines edges", run: () => update({ links: "all" }) },
    { id: "view-graph", label: "Go to the graph", keywords: "canvas view", run: () => update({ view: "graph" }, "push") },
    { id: "view-list", label: "Go to the list view", hint: "The graph as tables", icon: "list", keywords: "table accessible", run: () => update({ view: "list" }, "push") },
    { id: "view-schema", label: "Go to the schema", keywords: "classes predicates ontology", run: () => update({ view: "schema" }, "push") },
    ...(activeFilterCount ? [{ id: "reset", label: "Clear all filters", keywords: "reset show everything", run: resetFilters }] : []),
    { id: "evn", label: url.evidenceNodes ? "Hide evidence on the canvas" : "Show evidence around the selection", keywords: "records nodes", run: () => update({ evidenceNodes: !url.evidenceNodes }) },
    { id: "rail", label: railCollapsed ? "Show the filter panel" : "Hide the filter panel", keywords: "sidebar filters", run: () => setRailCollapsed((c) => !c) },
    { id: "theme", label: "Switch theme", hint: "Light or dark", icon: "moon", keywords: "dark light mode appearance", run: toggleTheme },
    { id: "theme-system", label: "Use the system theme", keywords: "dark light mode appearance auto os", run: followSystemTheme },
    { id: "copy", label: "Copy a link", hint: "To exactly this view", icon: "graph", keywords: "share url copy link view", run: () => void copyLink() },
    { id: "help", label: "Shortcuts", hint: "Every key and gesture", icon: "keyboard", keywords: "help keys keyboard shortcuts", shortcut: "?", run: () => setHelpOpen(true) },
  ];

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      notify("Link to this view copied. Anyone with access sees the same selection and filters.");
      setTimeout(() => setCopied(false), 1800);
    } catch {
      notify("Copying failed. Copy the address bar instead.");
    }
  };

  const switchRole = async (role: ViewerRole) => {
    try {
      const res = await fetch("/api/session/role", {
        method: "POST",
        body: JSON.stringify({ role }),
        headers: { "content-type": "application/json" },
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      window.location.reload();
    } catch (err) {
      notify(`Couldn’t switch role (${(err as Error).message}). Check your connection and try again.`);
    }
  };

  const inspectorOpen = !!(url.node || url.edge);

  return (
    <IconSetContext.Provider value={iconSet}>
    <div
      className={`ox-app${railOpen ? " rail-open" : ""}${railCollapsed ? " rail-collapsed" : ""}${inspectorOpen ? " has-inspector" : ""}${url.ev ? " has-sheet" : ""}`}
    >
      <a className="ox-skip" href="#ox-main">
        Skip to the graph
      </a>
      <header className="ox-header">
        <div className="ox-brand">
          {/* eslint-disable-next-line @next/next/no-img-element -- static brand SVG */}
          <img className="ox-brand__mark" src="/brand/wayam-mark.svg" width={26} height={26} alt="" aria-hidden="true" />
          <h1 className="ox-brand__title">
            Wayam <span className="ox-brand__sub">Ontology Explorer</span>
          </h1>
        </div>

        <Segmented
          label="View"
          className="ox-views"
          value={url.view}
          onChange={(v) => update({ view: v }, "push")}
          options={[
            { value: "graph", label: "Graph" },
            { value: "list", label: "List" },
            { value: "schema", label: "Schema" },
          ]}
        />

        <SearchBox ref={searchRef} adapter={adapter} types={types} onPick={(id) => void selectNode(id, "search")} />
        <button type="button" className="ox-btn ox-btn--quiet ox-cmdbtn" onClick={() => setCmdOpen(true)} title="Command bar (Ctrl+K)">
          <kbd>Ctrl K</kbd>
          <span className="sr-only">Open the command bar</span>
        </button>
        <button
          type="button"
          className="ox-btn ox-btn--quiet ox-pathbtn"
          onClick={() => {
            update({ view: "graph" });
            setPathFinder({ from: url.node ?? rootId, busy: false, error: null });
          }}
        >
          <Icon name="route" />
          <span className="ox-hide-narrow">Find path</span>
        </button>

        <div className="ox-header__end">
          <button type="button" className="ox-btn ox-btn--quiet ox-rail-toggle" aria-expanded={railOpen} onClick={() => setRailOpen(!railOpen)}>
            Filters
          </button>
          {initial.dataset.isDemo ? (
            <DemoBadge>
              Demo data<span className="ox-hide-narrow">, not verified</span>
            </DemoBadge>
          ) : (
            <span className="ox-live">Live data</span>
          )}
          <Select
            label="Viewing as"
            hideLabel
            size="s"
            className="ox-role"
            title="Demo access role"
            value={viewerRole}
            onChange={(v) => void switchRole(v)}
            options={[
              { value: "analyst", label: "Analyst", hint: "Internal records" },
              { value: "admin", label: "Admin", hint: "Includes restricted records" },
            ]}
          />
          <button type="button" className="ox-btn ox-btn--quiet ox-copybtn" onClick={() => void copyLink()} aria-label={copied ? "Link copied" : "Copy link"}>
            <Icon name="graph" size={15} />
            <span className="ox-hide-narrow">{copied ? "Link copied" : "Copy link"}</span>
          </button>
          <ThemeToggle />
        </div>
      </header>

      <PathTrail
        graph={model.graph}
        path={url.path}
        selectedNode={url.node}
        edge={selectedEdge}
        evidenceOpen={!!url.ev}
        recordId={url.record}
        onEntity={(id) => void selectNode(id, "crumb")}
        onEdge={(id) => void selectEdge(id)}
        onEvidence={() => update({ record: null }, "push")}
        onExport={() => void exportTrail()}
        exporting={exporting}
      />

      {!online && (
        <div className="ox-offline" role="status">
          You’re offline. The graph you’ve loaded still works; new data will load when you reconnect.
        </div>
      )}

      <div className="ox-main">
        <FilterRail
          state={url}
          graph={model.graph}
          rootId={rootId}
          types={initial.types}
          relationTypes={initial.relationTypes}
          familyTotals={familyTotals}
          shown={{ nodes: filter.nodeIds.size, edges: filter.edgeIds.size, hiddenNodes: filter.hiddenNodes, hiddenEdges: filter.hiddenEdges }}
          unloaded={unloaded}
          onChange={(p) => update(p)}
          onReset={resetFilters}
          onCollapse={() => setRailCollapsed(true)}
        />
        {railCollapsed && (
          <div className="ox-rail-strip">
            <button type="button" className="ox-rail-strip__btn" onClick={() => setRailCollapsed(false)} aria-label="Show the filter panel" title="Show filters">
              <Icon name="filter" />
              {activeFilterCount > 0 && <span className="ox-rail-strip__n">{activeFilterCount}</span>}
            </button>
          </div>
        )}

        <main className="ox-stage" id="ox-main" tabIndex={-1} aria-label="Ontology graph and evidence">
          <div className="ox-view">
            {url.view === "graph" ? (
              <GraphCanvas
                rootId={rootId}
                nodes={visibleNodes}
                edges={visibleEdges}
                positions={display.positions}
                zones={display.zones}
                types={types}
                selectedNode={url.node}
                selectedEdge={url.edge}
                hovered={hovered}
                pathIds={url.path}
                hiddenLinks={hiddenLinks}
                bundles={bundles}
                looseEdges={loose}
                openBundles={openBundles}
                linkMode={linkMode}
                linkModeLocked={linkModeLocked}
                fitKey={JSON.stringify([url.hideFamilies, url.rels, url.states, url.focus, url.isolate, url.hidden, railCollapsed])}
                reserveTop={58}
                topBarExtra={
                  <FilterChips
                    state={url}
                    types={initial.types}
                    relationTypes={initial.relationTypes}
                    labelOf={labelOf}
                    onChange={(p) => update(p)}
                    onClearAll={resetFilters}
                  />
                }
                onMenuAction={onMenuAction}
                onHelp={() => setHelpOpen(true)}
                onLinkMode={(m) => {
                  setOpenBundles(new Set());
                  update({ links: m });
                }}
                evidence={
                  evidenceAnchor && canvasEvidence.data && filter.nodeIds.has(evidenceAnchor)
                    ? { anchorId: evidenceAnchor, rows: canvasEvidence.data.items }
                    : null
                }
                focusRequest={focusRequest}
                reducedMotion={reducedMotion}
                actions={canvasActions}
                onExpand={(id) => expand(id, DEFAULT_EXPAND, false)}
                onHover={setHovered}
                onMove={(id, p) => {
                  const m = modelRef.current;
                  commit({ ...m, positions: new Map(m.positions).set(id, p) });
                }}
                onClear={clearSelection}
              />
            ) : url.view === "list" ? (
              <ListView
                graph={model.graph}
                nodeIds={filter.nodeIds}
                edgeIds={filter.edgeIds}
                types={types}
                selectedNode={url.node}
                selectedEdge={url.edge}
                onNode={(id) => void selectNode(id)}
                onEdge={(id) => void selectEdge(id)}
              />
            ) : (
              <SchemaView types={initial.types} relationTypes={initial.relationTypes} />
            )}
            {url.view === "list" && (
              <div className="ox-chips-wrap ox-chips-wrap--list">
                <FilterChips
                  state={url}
                  types={initial.types}
                  relationTypes={initial.relationTypes}
                  labelOf={labelOf}
                  onChange={(p) => update(p)}
                  onClearAll={resetFilters}
                />
              </div>
            )}
            {url.view === "graph" && pathFinder && (
              <PathFinder
                adapter={adapter}
                types={types}
                nodes={[...model.graph.nodes.values()]}
                from={pathFinder.from}
                busy={pathFinder.busy}
                error={pathFinder.error}
                onFrom={(id) => setPathFinder({ from: id, busy: false, error: null })}
                onFind={(to) => void findPath(pathFinder.from, to)}
                onClose={() => setPathFinder(null)}
              />
            )}
            {url.view === "graph" && !pathFinder && <FirstRunTip onHelp={() => setHelpOpen(true)} />}
            {url.view === "graph" && url.evidenceNodes && !evidenceAnchor && (
              <p className="ox-canvas-hint" role="status">
                Select an entity or relationship to show its evidence on the canvas.
              </p>
            )}
          </div>

          {url.ev && (
            <EvidenceSheet
              key={`${url.ev.kind}:${url.ev.id}`}
              adapter={adapter}
              target={url.ev}
              heading={evHeading}
              claimState={url.ev.kind === "rel" ? (model.graph.edges.get(url.ev.id)?.evidenceState ?? null) : null}
              filters={evFilters}
              activeRecord={url.record}
              onFilters={onEvFilters}
              onOpenRecord={openRecord}
              onClose={() => update({ ev: null }, "push")}
            />
          )}
        </main>

        <aside className="ox-side" aria-label="Details">
          {url.edge ? (
            <EdgeInspector
              key={url.edge}
              adapter={adapter}
              id={url.edge}
              types={types}
              onFocusEntity={(id) => void selectNode(id, "hop")}
              onSelectEdge={(id) => void selectEdge(id)}
              onOpenEvidence={() => openEvidence({ kind: "rel", id: url.edge! })}
              onOpenRecord={openRecord}
              onClose={clearSelection}
              back={
                selectedEdge
                  ? { label: labelOf(selectedEdge.subjectId), onClick: () => void selectNode(selectedEdge.subjectId, "crumb") }
                  : undefined
              }
            />
          ) : url.node ? (
            <NodeInspector
              key={url.node}
              adapter={adapter}
              id={url.node}
              rootId={rootId}
              types={types}
              relationTypes={initial.relationTypes}
              expansion={expansions[url.node]}
              isolated={url.isolate}
              onFocusEntity={(id) => void selectNode(id, "hop")}
              onSelectEdge={(id) => void selectEdge(id)}
              onOpenEvidence={() => openEvidence({ kind: "ent", id: url.node! })}
              onOpenRecord={openRecord}
              onExpand={(opts, more) => expand(url.node!, opts, more)}
              onCollapse={() => collapse(url.node!)}
              onToggleIsolate={() => update({ isolate: !url.isolate })}
              onClose={clearSelection}
              back={nodeBack}
            />
          ) : (
            <Welcome
              overview={initial}
              onStart={(id) => void selectNode(id, "search")}
              onEdge={(id) => void selectEdge(id)}
              onFindPath={() => {
                update({ view: "graph" });
                setPathFinder({ from: "vakyam", busy: false, error: null });
              }}
              onRecent={(r) => (r.kind === "node" ? void selectNode(r.id, "search") : void selectEdge(r.id))}
            />
          )}
        </aside>
      </div>

      {url.record && (
        <RecordViewer
          adapter={adapter}
          id={url.record}
          nav={recordNav}
          onClose={closeRecord}
          onShowClaim={showClaim}
          onOpenRecord={(rid) => update({ record: rid })}
        />
      )}

      <HelpDialog open={helpOpen} onClose={() => setHelpOpen(false)} />
      <CommandBar
        open={cmdOpen}
        adapter={adapter}
        types={types}
        commands={commands}
        onPickEntity={(id) => void selectNode(id, "search")}
        onClose={() => setCmdOpen(false)}
      />

      <div className="sr-only" aria-live="polite">
        {liveText}
      </div>
      <Toasts toasts={toasts} onDismiss={dismiss} />
    </div>
    </IconSetContext.Provider>
  );
}

function Welcome({
  overview,
  onStart,
  onEdge,
  onFindPath,
  onRecent,
}: {
  overview: OverviewResponse;
  onStart: (id: string) => void;
  onEdge: (id: string) => void;
  onFindPath: () => void;
  onRecent: (r: RecentItem) => void;
}) {
  const recent = useRecent();
  const fams = overview.types.filter((t) => t.family !== "company" && overview.familyCounts[t.family]);
  return (
    <section className="ox-inspector ox-welcome" aria-labelledby="ox-welcome-title">
      <div className="ox-inspector__body">
        <h2 id="ox-welcome-title" className="ox-welcome__title">
          Trace any claim back to its source
        </h2>
        <p className="ox-desc">
          Every line on the graph is an assertion. Select one to see what supports it, then open the records underneath. Lines
          drawn dashed have nothing behind them yet.
        </p>

        {recent.length > 0 && (
          <div className="ox-block">
            <h3 className="ox-h3">
              <Icon name="history" size={14} /> Pick up where you left off
            </h3>
            <ul className="ox-recent">
              {recent.map((r) => (
                <li key={`${r.kind}:${r.id}`}>
                  <button type="button" className="ox-recent__item" onClick={() => onRecent(r)}>
                    <span className="ox-recent__kind">{r.kind === "node" ? "Entity" : "Relationship"}</span>
                    {r.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="ox-block">
          <h3 className="ox-h3">Start from a known path</h3>
          <ul className="ox-journeys">
            <li>
              <button type="button" className="ox-journey" onClick={() => onEdge("r-vk-call")}>
                <span>Vakyam supports Call Analytics & QA</span>
                <span className="ox-journey__hint">Transcript segments and QA rows</span>
              </button>
            </li>
            <li>
              <button type="button" className="ox-journey" onClick={() => onEdge("r-safety-mining")}>
                <span>Safety & Surveillance applied in Mining</span>
                <span className="ox-journey__hint">Image regions with pixel locators</span>
              </button>
            </li>
            <li>
              <button type="button" className="ox-journey" onClick={() => onStart("computer-vision")}>
                <span>Computer Vision</span>
                <span className="ox-journey__hint">A capability shared across products</span>
              </button>
            </li>
            <li>
              <button type="button" className="ox-journey" onClick={onFindPath}>
                <span>How is Vakyam connected to BFSI?</span>
                <span className="ox-journey__hint">Find the shortest path between any two entities</span>
              </button>
            </li>
            <li>
              <button type="button" className="ox-journey" onClick={() => onEdge("r-aj-spatial")}>
                <span>Arjuna implements 3D / Spatial AI</span>
                <span className="ox-journey__hint">A disputed claim</span>
              </button>
            </li>
          </ul>
        </div>

        <div className="ox-block">
          <h3 className="ox-h3">Families</h3>
          <ul className="ox-famlist">
            {fams.map((t) => (
              <li key={t.id} style={familyVars(t.family)}>
                <span className="ox-famlist__glyph" aria-hidden="true">
                  {t.glyph}
                </span>
                {t.pluralLabel}
                <span className="ox-famlist__n">{overview.familyCounts[t.family]}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="ox-muted ox-small">
          Press <kbd>/</kbd> to search and <kbd>?</kbd> for every shortcut. Right-click an entity for more actions. The List view
          holds the same graph as tables.
        </p>
      </div>
    </section>
  );
}
