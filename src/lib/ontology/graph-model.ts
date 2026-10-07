import type { EdgeSummary, EntitySummary, EvidenceState, FamilyId, OntologyType } from "./types";

/**
 * Client-side graph display model. Domain data (what was fetched) lives in
 * GraphData; display state (positions, filters, selection) is computed from it
 * and never mutates it.
 */
export interface GraphData {
  nodes: Map<string, EntitySummary>;
  edges: Map<string, EdgeSummary>;
  /** nodeId → id of the entity whose expansion introduced it. Overview nodes are absent. */
  addedBy: Map<string, string>;
}

export function emptyGraph(): GraphData {
  return { nodes: new Map(), edges: new Map(), addedBy: new Map() };
}

export function mergeGraph(g: GraphData, nodes: EntitySummary[], edges: EdgeSummary[], expandedFrom?: string): GraphData {
  const next: GraphData = { nodes: new Map(g.nodes), edges: new Map(g.edges), addedBy: new Map(g.addedBy) };
  for (const n of nodes) {
    if (!next.nodes.has(n.id) && expandedFrom && n.id !== expandedFrom) next.addedBy.set(n.id, expandedFrom);
    next.nodes.set(n.id, n);
  }
  for (const e of edges) next.edges.set(e.id, e);
  return next;
}

/** Remove everything a node's expansion introduced (recursively), plus edges left dangling. */
export function collapseBranch(g: GraphData, id: string, protect: Set<string>): GraphData {
  const remove = new Set<string>();
  const walk = (from: string) => {
    for (const [child, parent] of g.addedBy) {
      if (parent === from && !remove.has(child) && !protect.has(child)) {
        remove.add(child);
        walk(child);
      }
    }
  };
  walk(id);
  if (!remove.size) return g;
  const nodes = new Map([...g.nodes].filter(([k]) => !remove.has(k)));
  const edges = new Map([...g.edges].filter(([, e]) => nodes.has(e.subjectId) && nodes.has(e.objectId)));
  const addedBy = new Map([...g.addedBy].filter(([k]) => !remove.has(k)));
  return { nodes, edges, addedBy };
}

export function adjacency(g: GraphData, edgeIds?: Set<string>): Map<string, Set<string>> {
  const adj = new Map<string, Set<string>>();
  for (const e of g.edges.values()) {
    if (edgeIds && !edgeIds.has(e.id)) continue;
    if (!adj.has(e.subjectId)) adj.set(e.subjectId, new Set());
    if (!adj.has(e.objectId)) adj.set(e.objectId, new Set());
    adj.get(e.subjectId)!.add(e.objectId);
    adj.get(e.objectId)!.add(e.subjectId);
  }
  return adj;
}

/** Undirected BFS shortest path, root first. Returns [target] when unreachable. */
export function shortestPath(g: GraphData, from: string, to: string): string[] {
  if (from === to) return [from];
  const adj = adjacency(g);
  const prev = new Map<string, string>([[from, from]]);
  const queue = [from];
  while (queue.length) {
    const cur = queue.shift()!;
    // Deterministic order keeps paths stable across renders.
    for (const n of [...(adj.get(cur) ?? [])].sort()) {
      if (prev.has(n)) continue;
      prev.set(n, cur);
      if (n === to) {
        const path = [to];
        let p = to;
        while (p !== from) {
          p = prev.get(p)!;
          path.unshift(p);
        }
        return path;
      }
      queue.push(n);
    }
  }
  return [to];
}

/** Edge that connects two entities, preferring a → b. */
export function edgeBetween(g: GraphData, a: string, b: string): EdgeSummary | null {
  let reverse: EdgeSummary | null = null;
  for (const e of g.edges.values()) {
    if (e.subjectId === a && e.objectId === b) return e;
    if (e.subjectId === b && e.objectId === a) reverse ??= e;
  }
  return reverse;
}

export interface FilterSpec {
  rootId: string;
  hideFamilies: string[];
  rels: string[];
  states: EvidenceState[];
  focus: string | null;
  isolate: string | null;
  /** Entities dismissed from the canvas. */
  hidden?: string[];
}

export interface FilterResult {
  nodeIds: Set<string>;
  edgeIds: Set<string>;
  hiddenNodes: number;
  hiddenEdges: number;
}

export function applyFilters(g: GraphData, f: FilterSpec): FilterResult {
  const hide = new Set(f.hideFamilies);
  const rels = f.rels.length ? new Set(f.rels) : null;
  const states = f.states.length ? new Set(f.states) : null;

  const dismissed = new Set(f.hidden ?? []);
  let nodeIds = new Set(
    [...g.nodes.values()].filter((n) => n.id === f.rootId || (!hide.has(n.family) && !dismissed.has(n.id))).map((n) => n.id),
  );
  let edgeIds = new Set(
    [...g.edges.values()]
      .filter(
        (e) =>
          nodeIds.has(e.subjectId) &&
          nodeIds.has(e.objectId) &&
          (!rels || rels.has(e.relationTypeId)) &&
          (!states || states.has(e.evidenceState)),
      )
      .map((e) => e.id),
  );

  const neighbourhood = (center: string, hops: number) => {
    const adj = adjacency(g, edgeIds);
    const keep = new Set([center]);
    let frontier = [center];
    for (let i = 0; i < hops; i++) {
      const next: string[] = [];
      for (const id of frontier) {
        for (const n of adj.get(id) ?? []) {
          if (keep.has(n)) continue;
          keep.add(n);
          next.push(n);
        }
      }
      frontier = next;
    }
    return keep;
  };

  if (f.focus && g.nodes.has(f.focus)) {
    const keep = neighbourhood(f.focus, 2);
    keep.add(f.rootId);
    nodeIds = new Set([...nodeIds].filter((id) => keep.has(id)));
  }
  if (f.isolate && g.nodes.has(f.isolate)) {
    const keep = neighbourhood(f.isolate, 1);
    nodeIds = new Set([...nodeIds].filter((id) => keep.has(id)));
  }
  // When relation/state filters are active, drop nodes left with no visible link (root stays).
  edgeIds = new Set([...edgeIds].filter((id) => {
    const e = g.edges.get(id)!;
    return nodeIds.has(e.subjectId) && nodeIds.has(e.objectId);
  }));
  if (rels || states) {
    const touched = new Set<string>([f.rootId]);
    for (const id of edgeIds) {
      const e = g.edges.get(id)!;
      touched.add(e.subjectId);
      touched.add(e.objectId);
    }
    nodeIds = new Set([...nodeIds].filter((id) => touched.has(id)));
  }
  return {
    nodeIds,
    edgeIds,
    hiddenNodes: g.nodes.size - nodeIds.size,
    hiddenEdges: g.edges.size - edgeIds.size,
  };
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

export const NODE_W = 212;
export const NODE_H = 40;
export const ROOT_W = 232;
export const ROOT_H = 68;
const COL_GAP = 12;
const ROW_GAP = 10;
const ZONE_HEAD = 52;
const ZONE_PAD = 16;

/** Canonical family order, used for tie-breaks and legends. */
export const FAMILY_ORDER: FamilyId[] = ["product", "capability", "technology", "data", "solution", "industry", "stakeholder", "client"];

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Zone extends Rect {
  family: FamilyId;
  label: string;
  count: number;
}

export interface Layout {
  positions: Map<string, Point>;
  zones: Zone[];
}

/**
 * Eight slots around the company node, clockwise from twelve o'clock: a 3×3
 * grid with the company in the middle. A grid suits a widescreen canvas far
 * better than a ring, so the overview fits at a readable zoom.
 */
const SLOT_X = 548;
const SLOT_Y = 330;
export const SLOTS: Point[] = [
  [0, -1],
  [1, -1],
  [1, 0],
  [1, 1],
  [0, 1],
  [-1, 1],
  [-1, 0],
  [-1, -1],
].map(([x, y]) => ({ x: x * SLOT_X, y: y * SLOT_Y }));

const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);
const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

/** How many links connect each pair of families. */
export function familyWeights(nodes: EntitySummary[], edges: EdgeSummary[]): Map<string, number> {
  const fam = new Map(nodes.map((n) => [n.id, n.family]));
  const w = new Map<string, number>();
  for (const e of edges) {
    const a = fam.get(e.subjectId);
    const b = fam.get(e.objectId);
    if (!a || !b || a === b) continue;
    const k = pairKey(a, b);
    w.set(k, (w.get(k) ?? 0) + 1);
  }
  return w;
}

/**
 * Assign families to slots so heavily linked families sit next to each other.
 * Exhaustive search (at most 7! arrangements) with Products pinned to the top,
 * as in the reference graphic. Deterministic: ties keep the canonical order.
 */
export function assignSlots(families: FamilyId[], weights: Map<string, number>): Map<FamilyId, number> {
  const pinned: FamilyId = families.includes("product") ? "product" : families[0];
  const rest = families.filter((f) => f !== pinned);
  const origin = { x: 0, y: 0 };
  const cost = (slots: number[]) => {
    const pos = new Map<FamilyId, Point>([[pinned, SLOTS[0]]]);
    rest.forEach((f, i) => pos.set(f, SLOTS[slots[i]]));
    let c = 0;
    for (const [k, w] of weights) {
      const [a, b] = k.split("|") as FamilyId[];
      const pa = a === "company" ? origin : pos.get(a);
      const pb = b === "company" ? origin : pos.get(b);
      if (pa && pb) c += w * dist(pa, pb);
    }
    return c;
  };
  let best: number[] = rest.map((_, i) => i + 1);
  let bestCost = Infinity;
  const cur: number[] = [];
  const used = new Set<number>([0]);
  const search = (k: number) => {
    if (k === rest.length) {
      const c = cost(cur);
      if (c < bestCost - 1e-6) {
        bestCost = c;
        best = [...cur];
      }
      return;
    }
    for (let slot = 1; slot < SLOTS.length; slot++) {
      if (used.has(slot)) continue;
      used.add(slot);
      cur[k] = slot;
      search(k + 1);
      used.delete(slot);
    }
  };
  search(0);
  const out = new Map<FamilyId, number>([[pinned, 0]]);
  rest.forEach((f, i) => out.set(f, best[i]));
  return out;
}

function zoneSize(count: number) {
  const cols = count >= 4 ? 2 : 1;
  const rows = Math.ceil(count / cols);
  return {
    cols,
    w: cols * NODE_W + (cols - 1) * COL_GAP + ZONE_PAD * 2,
    h: ZONE_HEAD + rows * NODE_H + (rows - 1) * ROW_GAP + ZONE_PAD,
  };
}

const centerOf = (p: Point, id: string, rootId: string) => (id === rootId ? { x: 0, y: 0 } : { x: p.x + NODE_W / 2, y: p.y + NODE_H / 2 });

/**
 * Curated overview: the company in the middle, families as soft zones in a grid
 * around it. Family placement minimises total link length; members inside a
 * zone are ordered by where their neighbours are (barycentre), which removes
 * most crossings. Deterministic, so positions are stable between visits.
 */
export function overviewLayout(nodes: EntitySummary[], types: OntologyType[], rootId: string, edges: EdgeSummary[] = []): Layout {
  const positions = new Map<string, Point>();
  positions.set(rootId, { x: -ROOT_W / 2, y: -ROOT_H / 2 });
  const byFamily = new Map<FamilyId, EntitySummary[]>();
  for (const n of nodes) {
    if (n.id === rootId) continue;
    if (!byFamily.has(n.family)) byFamily.set(n.family, []);
    byFamily.get(n.family)!.push(n);
  }
  const families = FAMILY_ORDER.filter((f) => byFamily.has(f)).slice(0, SLOTS.length);
  const slots = assignSlots(families, familyWeights(nodes, edges));

  const zones: Zone[] = families.map((family) => {
    const members = byFamily.get(family)!;
    const { w, h } = zoneSize(members.length);
    const c = SLOTS[slots.get(family)!];
    const type = types.find((t) => t.family === family);
    return { family, x: Math.round(c.x - w / 2), y: Math.round(c.y - h / 2), w, h, label: type?.pluralLabel ?? family, count: members.length };
  });

  const place = (zone: Zone, ordered: EntitySummary[]) => {
    const { cols } = zoneSize(ordered.length);
    ordered.forEach((m, j) => {
      positions.set(m.id, {
        x: zone.x + ZONE_PAD + (j % cols) * (NODE_W + COL_GAP),
        y: zone.y + ZONE_HEAD + Math.floor(j / cols) * (NODE_H + ROW_GAP),
      });
    });
  };
  for (const z of zones) place(z, byFamily.get(z.family)!);

  // Barycentre passes: order members by the mean position of their neighbours.
  const neighbours = new Map<string, string[]>();
  for (const e of edges) {
    if (!neighbours.has(e.subjectId)) neighbours.set(e.subjectId, []);
    if (!neighbours.has(e.objectId)) neighbours.set(e.objectId, []);
    neighbours.get(e.subjectId)!.push(e.objectId);
    neighbours.get(e.objectId)!.push(e.subjectId);
  }
  for (let pass = 0; pass < 3; pass++) {
    for (const z of zones) {
      const members = byFamily.get(z.family)!;
      const own = new Set(members.map((m) => m.id));
      const { cols } = zoneSize(members.length);
      const scored = members.map((m, idx) => {
        const here = centerOf(positions.get(m.id)!, m.id, rootId);
        const pts = (neighbours.get(m.id) ?? [])
          .filter((n) => positions.has(n) && !own.has(n))
          .map((n) => centerOf(positions.get(n)!, n, rootId));
        if (!pts.length) return { m, x: here.x, y: here.y, idx };
        return { m, x: pts.reduce((a, p) => a + p.x, 0) / pts.length, y: pts.reduce((a, p) => a + p.y, 0) / pts.length, idx };
      });
      scored.sort((a, b) => a.y - b.y || a.idx - b.idx);
      const ordered: EntitySummary[] = [];
      for (let r = 0; r < scored.length; r += cols) {
        ordered.push(...scored.slice(r, r + cols).sort((a, b) => a.x - b.x || a.idx - b.idx).map((s) => s.m));
      }
      place(z, ordered);
    }
  }
  return { positions, zones };
}

/**
 * While filters hide members, slide the remaining overview members of each zone
 * up into the first free cells (keeping their relative order) so zones don't
 * show gaps. Nodes outside zones (expanded detail nodes) keep their positions.
 */
export function compactZones(
  positions: Map<string, Point>,
  zones: Zone[],
  visible: EntitySummary[],
): { positions: Map<string, Point>; zones: Zone[] } {
  const out = new Map(positions);
  const resized: Zone[] = [];
  for (const z of zones) {
    const members = visible
      .filter((n) => n.family === z.family && n.tier === "overview")
      .filter((n) => {
        const p = positions.get(n.id);
        return !!p && p.x >= z.x && p.x < z.x + z.w && p.y >= z.y && p.y < z.y + z.h;
      })
      .sort((a, b) => {
        const pa = positions.get(a.id)!;
        const pb = positions.get(b.id)!;
        return pa.y - pb.y || pa.x - pb.x;
      });
    const { cols } = zoneSize(z.count);
    members.forEach((m, j) => {
      out.set(m.id, {
        x: z.x + ZONE_PAD + (j % cols) * (NODE_W + COL_GAP),
        y: z.y + ZONE_HEAD + Math.floor(j / cols) * (NODE_H + ROW_GAP),
      });
    });
    // Shrink the zone to its remaining rows, keeping it centred on its slot.
    const rows = Math.max(1, Math.ceil(members.length / cols));
    const h = ZONE_HEAD + rows * NODE_H + (rows - 1) * ROW_GAP + ZONE_PAD;
    const dy = Math.round((z.h - h) / 2);
    for (const m of members) {
      const p = out.get(m.id)!;
      out.set(m.id, { x: p.x, y: p.y + dy });
    }
    resized.push({ ...z, y: z.y + dy, h });
  }
  return { positions: out, zones: resized };
}

function collides(p: Point, positions: Map<string, Point>, obstacles: Rect[]): boolean {
  for (const q of positions.values()) {
    if (Math.abs(p.x - q.x) < NODE_W + 14 && Math.abs(p.y - q.y) < NODE_H + 12) return true;
  }
  for (const r of obstacles) {
    if (p.x < r.x + r.w + 14 && p.x + NODE_W + 14 > r.x && p.y < r.y + r.h + 12 && p.y + NODE_H + 12 > r.y) return true;
  }
  return false;
}

/**
 * Place new nodes in a fan outward from their anchor, away from the centre,
 * stepping past existing nodes and family zones. Existing positions never move.
 */
export function placeAround(anchor: Point, ids: string[], positions: Map<string, Point>, obstacles: Rect[] = []): Map<string, Point> {
  const placed = new Map(positions);
  const cx = anchor.x + NODE_W / 2;
  const cy = anchor.y + NODE_H / 2;
  const len = Math.hypot(cx, cy);
  const dx = len < 1 ? 0 : cx / len;
  const dy = len < 1 ? 1 : cy / len;
  const px = -dy;
  const py = dx;
  const fresh = ids.filter((id) => !placed.has(id));
  fresh.forEach((id, k) => {
    const offset = (k - (fresh.length - 1) / 2) * 56;
    let d = 200;
    let p: Point = { x: 0, y: 0 };
    for (let attempt = 0; attempt < 24; attempt++) {
      p = {
        x: Math.round(cx + dx * d + px * offset * 2.4 - NODE_W / 2),
        y: Math.round(cy + dy * d + py * offset - NODE_H / 2),
      };
      if (!collides(p, placed, obstacles)) break;
      d += 50;
    }
    placed.set(id, p);
  });
  return placed;
}

// ---------------------------------------------------------------------------
// Link bundling
// ---------------------------------------------------------------------------

export interface Bundle {
  id: string;
  /** Family the links mostly start from, and the one they mostly end at. */
  from: FamilyId;
  to: FamilyId;
  /** Canvas endpoints: the company node, or a family zone. */
  source: string;
  target: string;
  edges: EdgeSummary[];
  byState: Record<EvidenceState, number>;
  relations: Array<{ label: string; count: number }>;
  /** Links running from→to, and to→from. Drives the band's arrowheads. */
  forward: number;
  backward: number;
}

export const zoneNodeId = (f: FamilyId) => `zone:${f}`;

/**
 * Group overview links by family pair so the resting canvas shows one band per
 * pair instead of dozens of overlapping lines. Links touching detail-tier nodes
 * (placed outside zones) or staying within one family come back as `loose`.
 */
export function bundleEdges(
  edges: EdgeSummary[],
  nodes: Map<string, EntitySummary>,
  rootId: string,
): { bundles: Bundle[]; loose: Set<string> } {
  const groups = new Map<string, EdgeSummary[]>();
  const loose = new Set<string>();
  for (const e of edges) {
    const s = nodes.get(e.subjectId);
    const o = nodes.get(e.objectId);
    if (!s || !o || s.tier !== "overview" || o.tier !== "overview" || s.family === o.family) {
      loose.add(e.id);
      continue;
    }
    const k = pairKey(s.family, o.family);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(e);
  }
  const endpoint = (f: FamilyId) => (f === "company" ? rootId : zoneNodeId(f));
  const bundles: Bundle[] = [];
  for (const [k, list] of groups) {
    const [a, b] = k.split("|") as FamilyId[];
    const aAsSubject = list.filter((e) => nodes.get(e.subjectId)!.family === a).length;
    const [from, to] = aAsSubject >= list.length - aAsSubject ? [a, b] : [b, a];
    const byState: Record<EvidenceState, number> = { verified: 0, linked: 0, none: 0, disputed: 0 };
    const rel = new Map<string, number>();
    for (const e of list) {
      byState[e.evidenceState] += 1;
      rel.set(e.label, (rel.get(e.label) ?? 0) + 1);
    }
    bundles.push({
      id: k.replace("|", "~"),
      from,
      to,
      source: endpoint(from),
      target: endpoint(to),
      edges: list,
      forward: list.filter((e) => nodes.get(e.subjectId)!.family === from).length,
      backward: list.filter((e) => nodes.get(e.subjectId)!.family === to).length,
      byState,
      relations: [...rel].map(([label, count]) => ({ label, count })).sort((x, y) => y.count - x.count || x.label.localeCompare(y.label)),
    });
  }
  bundles.sort((x, y) => x.id.localeCompare(y.id));
  return { bundles, loose };
}
