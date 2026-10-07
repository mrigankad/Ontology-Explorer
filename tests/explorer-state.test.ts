import { describe, expect, it } from "vitest";
import { DEFAULT_STATE, nextPath, parseState, serializeState } from "@/lib/ontology/url-state";
import {
  applyFilters,
  collapseBranch,
  emptyGraph,
  mergeGraph,
  NODE_H,
  NODE_W,
  overviewLayout,
  placeAround,
  shortestPath,
} from "@/lib/ontology/graph-model";
import { viewerFor } from "@/lib/ontology/access";
import { DEMO_DATASET, OntologyRepository } from "@/lib/ontology/repository";

const repo = new OntologyRepository(DEMO_DATASET);
const v = viewerFor("analyst");
const o = repo.overview(v);
const g = mergeGraph(emptyGraph(), o.nodes, o.edges);
const noFilters = { rootId: "wayam", hideFamilies: [], rels: [], states: [], focus: null, isolate: null };

describe("url state", () => {
  it("round-trips the graph → evidence → record journey and returns to the same selection", () => {
    const s = {
      ...DEFAULT_STATE,
      edge: "r-vk-call",
      path: ["wayam", "vakyam"],
      ev: { kind: "rel" as const, id: "r-vk-call" },
      evStance: "supports" as const,
      record: "rec-call-disclosure",
      hideFamilies: ["stakeholder"],
    };
    const parsed = parseState(new URLSearchParams(serializeState(s)));
    expect(parsed).toEqual(s);
    const back = parseState(new URLSearchParams(serializeState({ ...parsed, record: null })));
    expect(back.edge).toBe("r-vk-call");
    expect(back.path).toEqual(["wayam", "vakyam"]);
    expect(back.ev).toEqual({ kind: "rel", id: "r-vk-call" });
    expect(back.hideFamilies).toEqual(["stakeholder"]);
  });

  it("ignores junk values", () => {
    const s = parseState(new URLSearchParams("view=nope&evsort=drop&ev=bad"));
    expect(s.view).toBe("graph");
    expect(s.evSort).toBe("created_desc");
    expect(s.ev).toBeNull();
  });
});

describe("path trail", () => {
  const adj = (a: string, b: string) =>
    [...g.edges.values()].some((e) => (e.subjectId === a && e.objectId === b) || (e.subjectId === b && e.objectId === a));
  const sp = (id: string) => shortestPath(g, "wayam", id);

  it("appends hops, truncates on revisit, and falls back to the shortest path", () => {
    let p = ["wayam"];
    p = nextPath(p, "wayameye", adj, sp);
    p = nextPath(p, "safety-surveillance", adj, sp);
    p = nextPath(p, "mining", adj, sp);
    expect(p).toEqual(["wayam", "wayameye", "safety-surveillance", "mining"]);
    expect(nextPath(p, "wayameye", adj, sp)).toEqual(["wayam", "wayameye"]);
    const jump = nextPath(p, "developer", adj, sp);
    expect(jump[0]).toBe("wayam");
    expect(jump.at(-1)).toBe("developer");
  });
});

describe("node and edge selection model", () => {
  it("counts hidden nodes after hiding a family", () => {
    const r = applyFilters(g, { ...noFilters, hideFamilies: ["stakeholder"] });
    expect(r.hiddenNodes).toBe(7);
    expect(r.nodeIds.has("wayam")).toBe(true);
  });

  it("isolates a selection to its one-hop neighbourhood", () => {
    const r = applyFilters(g, { ...noFilters, isolate: "vakyam" });
    expect(r.nodeIds).toEqual(new Set(["vakyam", "wayam", "nlp", "call-analytics", "audio", "llms", "compliance-team"]));
  });

  it("filters by evidence state", () => {
    const r = applyFilters(g, { ...noFilters, states: ["disputed"] });
    expect([...r.edgeIds]).toEqual(["r-aj-spatial"]);
  });

  it("focuses on a product's two-hop neighbourhood", () => {
    const r = applyFilters(g, { ...noFilters, focus: "vakyam" });
    expect(r.nodeIds.has("bfsi")).toBe(true);
    expect(r.nodeIds.has("mining")).toBe(false);
  });

  it("lays out deterministically without overlapping nodes", () => {
    const a = overviewLayout(o.nodes, o.types, "wayam");
    const b = overviewLayout(o.nodes, o.types, "wayam");
    expect([...a.positions]).toEqual([...b.positions]);
    const pts = [...a.positions.values()];
    for (let i = 0; i < pts.length; i++)
      for (let j = i + 1; j < pts.length; j++)
        expect(Math.abs(pts[i].x - pts[j].x) >= NODE_W || Math.abs(pts[i].y - pts[j].y) >= NODE_H).toBe(true);
    const placed = placeAround(a.positions.get("computer-vision")!, ["x1", "x2"], a.positions);
    expect(placed.get("computer-vision")).toEqual(a.positions.get("computer-vision"));
    expect(placed.has("x1") && placed.has("x2")).toBe(true);
  });

  it("collapses only what an expansion added", () => {
    const n = repo.neighbors(v, "computer-vision", { direction: "in", relations: ["part_of"] })!;
    const expanded = mergeGraph(g, n.nodes, n.edges, "computer-vision");
    expect(expanded.nodes.has("ocr")).toBe(true);
    const collapsed = collapseBranch(expanded, "computer-vision", new Set());
    expect(collapsed.nodes.has("ocr")).toBe(false);
    expect(collapsed.nodes.size).toBe(g.nodes.size);
  });
});
