import type { EvidenceSort, EvidenceState, RecordKind, Stance } from "./types";

/**
 * Everything needed to reproduce a view lives in the query string, so any view
 * (a selected node, an open evidence table, a record) is a shareable URL and
 * survives reloads and back/forward navigation.
 */
export interface ExplorerUrlState {
  view: "graph" | "list" | "schema";
  node: string | null;
  edge: string | null;
  /** Traversal trail of entity ids, root first. */
  path: string[];
  /** Families hidden by the filter rail. */
  hideFamilies: string[];
  /** Relation types shown (empty = all). */
  rels: string[];
  /** Evidence states shown (empty = all). */
  states: EvidenceState[];
  /** Keep only entities within two hops of this entity. */
  focus: string | null;
  /** Entities whose neighbourhood has been expanded. */
  expanded: string[];
  isolate: boolean;
  evidenceNodes: boolean;
  /** Entities the user dismissed from the canvas. */
  hidden: string[];
  /** Draw family-pair bands (default) or every individual link. */
  links: "bundled" | "all";
  /** Open evidence table target. */
  ev: { kind: "rel" | "ent"; id: string } | null;
  evQuery: string;
  evKind: RecordKind | null;
  evStance: Stance | null;
  evSource: string | null;
  evFrom: string | null;
  evTo: string | null;
  evSort: EvidenceSort;
  record: string | null;
}

export const DEFAULT_STATE: ExplorerUrlState = {
  view: "graph",
  node: null,
  edge: null,
  path: [],
  hideFamilies: [],
  rels: [],
  states: [],
  focus: null,
  expanded: [],
  isolate: false,
  evidenceNodes: false,
  hidden: [],
  links: "bundled",
  ev: null,
  evQuery: "",
  evKind: null,
  evStance: null,
  evSource: null,
  evFrom: null,
  evTo: null,
  evSort: "created_desc",
  record: null,
};

const list = (v: string | null) => (v ? v.split(",").filter(Boolean) : []);
const VIEWS = ["graph", "list", "schema"] as const;
const SORTS: EvidenceSort[] = ["created_desc", "created_asc", "title_asc", "kind_asc", "stance_asc"];

export function parseState(sp: URLSearchParams): ExplorerUrlState {
  const view = sp.get("view");
  const ev = sp.get("ev");
  const evMatch = ev?.match(/^(rel|ent):(.+)$/);
  const sort = sp.get("evsort") as EvidenceSort | null;
  return {
    view: VIEWS.includes(view as (typeof VIEWS)[number]) ? (view as ExplorerUrlState["view"]) : "graph",
    node: sp.get("node"),
    edge: sp.get("edge"),
    path: list(sp.get("path")),
    hideFamilies: list(sp.get("hide")),
    rels: list(sp.get("rels")),
    states: list(sp.get("states")) as EvidenceState[],
    focus: sp.get("focus"),
    expanded: list(sp.get("exp")),
    isolate: sp.get("iso") === "1",
    evidenceNodes: sp.get("evn") === "1",
    hidden: list(sp.get("hid")),
    links: sp.get("links") === "all" ? "all" : "bundled",
    ev: evMatch ? { kind: evMatch[1] as "rel" | "ent", id: evMatch[2] } : null,
    evQuery: sp.get("evq") ?? "",
    evKind: (sp.get("evk") as RecordKind) || null,
    evStance: (sp.get("evs") as Stance) || null,
    evSource: sp.get("evsrc"),
    evFrom: sp.get("evfrom"),
    evTo: sp.get("evto"),
    evSort: sort && SORTS.includes(sort) ? sort : "created_desc",
    record: sp.get("rec"),
  };
}

export function serializeState(s: ExplorerUrlState): string {
  const sp = new URLSearchParams();
  const set = (k: string, v: string | null | undefined | false) => {
    if (v) sp.set(k, v);
  };
  if (s.view !== "graph") set("view", s.view);
  set("node", s.node);
  set("edge", s.edge);
  set("path", s.path.join(","));
  set("hide", s.hideFamilies.join(","));
  set("rels", s.rels.join(","));
  set("states", s.states.join(","));
  set("focus", s.focus);
  set("exp", s.expanded.join(","));
  set("iso", s.isolate && "1");
  set("evn", s.evidenceNodes && "1");
  set("hid", s.hidden.join(","));
  if (s.links === "all") set("links", "all");
  set("ev", s.ev ? `${s.ev.kind}:${s.ev.id}` : null);
  set("evq", s.evQuery);
  set("evk", s.evKind);
  set("evs", s.evStance);
  set("evsrc", s.evSource);
  set("evfrom", s.evFrom);
  set("evto", s.evTo);
  if (s.evSort !== "created_desc") set("evsort", s.evSort);
  set("rec", s.record);
  return sp.toString();
}

/**
 * Update the traversal trail when an entity is selected:
 *  - already on the trail → truncate back to it
 *  - adjacent to the trail's tip → append (a hop)
 *  - otherwise → replace with the shortest known path from the root
 */
export function nextPath(
  path: string[],
  target: string,
  adjacent: (a: string, b: string) => boolean,
  shortestFromRoot: (id: string) => string[],
): string[] {
  const at = path.indexOf(target);
  if (at >= 0) return path.slice(0, at + 1);
  const tip = path[path.length - 1];
  if (tip && adjacent(tip, target)) return [...path, target];
  return shortestFromRoot(target);
}
