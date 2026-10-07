import { describe, expect, it } from "vitest";
import {
  applyFilters,
  assignSlots,
  bundleEdges,
  compactZones,
  emptyGraph,
  familyWeights,
  mergeGraph,
  overviewLayout,
  placeAround,
  SLOTS,
  zoneNodeId,
} from "@/lib/ontology/graph-model";
import { viewerFor } from "@/lib/ontology/access";
import { DEMO_DATASET, OntologyRepository } from "@/lib/ontology/repository";
import { DEFAULT_STATE, parseState, serializeState } from "@/lib/ontology/url-state";
import { planLabels, routePath } from "@/components/explorer/graph/geometry";

const repo = new OntologyRepository(DEMO_DATASET);
const o = repo.overview(viewerFor("analyst"));
const nodes = new Map(o.nodes.map((n) => [n.id, n]));
const layout = overviewLayout(o.nodes, o.types, "wayam", o.edges);

describe("family placement", () => {
  it("pins Products to the top slot and uses each slot once", () => {
    const families = [...new Set(o.nodes.filter((n) => n.family !== "company").map((n) => n.family))];
    const slots = assignSlots(families, familyWeights(o.nodes, o.edges));
    expect(slots.get("product")).toBe(0);
    expect(new Set(slots.values()).size).toBe(families.length);
  });

  it("places the most connected family pairs next to each other", () => {
    const zone = (f: string) => layout.zones.find((z) => z.family === f)!;
    const centre = (f: string) => ({ x: zone(f).x + zone(f).w / 2, y: zone(f).y + zone(f).h / 2 });
    const d = (a: string, b: string) => Math.hypot(centre(a).x - centre(b).x, centre(a).y - centre(b).y);
    // Use cases link heavily to both capabilities and industries: both must sit in
    // adjacent grid cells (diagonals count), never across the canvas.
    const adjacent = Math.hypot(Math.abs(SLOTS[2].x), Math.abs(SLOTS[0].y)) + 1;
    expect(d("solution", "capability")).toBeLessThanOrEqual(adjacent);
    expect(d("solution", "industry")).toBeLessThanOrEqual(adjacent);
  });

  it("keeps every member inside its zone without overlaps", () => {
    for (const z of layout.zones) {
      for (const n of o.nodes.filter((m) => m.family === z.family)) {
        const p = layout.positions.get(n.id)!;
        expect(p.x).toBeGreaterThanOrEqual(z.x);
        expect(p.y).toBeGreaterThanOrEqual(z.y);
        expect(p.x).toBeLessThan(z.x + z.w);
        expect(p.y).toBeLessThan(z.y + z.h);
      }
    }
    for (let i = 0; i < layout.zones.length; i++)
      for (let j = i + 1; j < layout.zones.length; j++) {
        const a = layout.zones[i];
        const b = layout.zones[j];
        const apart = a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y;
        expect(apart).toBe(true);
      }
  });

  it("places expanded nodes outside every zone", () => {
    const placed = placeAround(layout.positions.get("computer-vision")!, ["x1", "x2", "x3"], layout.positions, layout.zones);
    for (const id of ["x1", "x2", "x3"]) {
      const p = placed.get(id)!;
      for (const z of layout.zones) {
        const inside = p.x < z.x + z.w && p.x + 212 > z.x && p.y < z.y + z.h && p.y + 40 > z.y;
        expect(inside).toBe(false);
      }
    }
  });
});

describe("link bundling", () => {
  const { bundles, loose } = bundleEdges(o.edges, nodes, "wayam");

  it("accounts for every overview link exactly once", () => {
    const bundled = bundles.flatMap((b) => b.edges.map((e) => e.id));
    expect(new Set(bundled).size).toBe(bundled.length);
    expect(bundled.length + loose.size).toBe(o.edges.length);
  });

  it("groups by family pair with counts, predicates and evidence states", () => {
    const cs = bundles.find((b) => b.id === "capability~solution")!;
    expect(cs.edges.length).toBe(cs.relations.reduce((a, r) => a + r.count, 0));
    expect(cs.relations[0].label).toBe("enables");
    expect(cs.from).toBe("capability");
    expect(Object.values(cs.byState).reduce((a, b) => a + b, 0)).toBe(cs.edges.length);
  });

  it("connects company bands to the company node and others to zones", () => {
    const dev = bundles.find((b) => b.from === "company")!;
    expect(dev.source).toBe("wayam");
    expect(dev.target).toBe(zoneNodeId("product"));
  });

  it("leaves links to detail-tier entities unbundled", () => {
    const n = repo.neighbors(viewerFor("analyst"), "computer-vision", { direction: "in", relations: ["part_of"] })!;
    const g = mergeGraph(mergeGraph(emptyGraph(), o.nodes, o.edges), n.nodes, n.edges);
    const r = bundleEdges([...g.edges.values()], g.nodes, "wayam");
    expect(r.loose.has("r-ocr-cv")).toBe(true);
  });
});

describe("label planning", () => {
  it("moves colliding labels apart along their routes", () => {
    const a = { x: 0, y: 0, w: 100, h: 40 };
    const b = { x: 600, y: 0, w: 100, h: 40 };
    const routes = [
      { id: "one", route: routePath(a, b, 0, false) },
      { id: "two", route: routePath(a, b, 0, false) },
    ];
    const plan = planLabels(routes, { w: 80, h: 30 });
    expect(plan.get("one")).toBe(0.5);
    expect(plan.get("two")).not.toBe(0.5);
  });

  it("bows links away from the centre node", () => {
    const top = { x: 0, y: -400, w: 200, h: 40 };
    const bottom = { x: 0, y: 400, w: 200, h: 40 };
    expect(routePath(top, bottom, 0, true).path).toContain("Q");
    expect(routePath(top, bottom, 0, false).path).not.toContain("Q");
  });
});

describe("hiding and compacting", () => {
  const g = mergeGraph(emptyGraph(), o.nodes, o.edges);

  it("drops dismissed entities but never the root", () => {
    const r = applyFilters(g, { rootId: "wayam", hideFamilies: [], rels: [], states: [], focus: null, isolate: null, hidden: ["vakyam", "wayam"] });
    expect(r.nodeIds.has("vakyam")).toBe(false);
    expect(r.nodeIds.has("wayam")).toBe(true);
  });

  it("closes gaps in zones and shrinks them while filtered", () => {
    const visible = o.nodes.filter((n) => n.id !== "vakyam" && n.id !== "pariksha");
    const { positions, zones } = compactZones(layout.positions, layout.zones, visible);
    const product = zones.find((z) => z.family === "product")!;
    const before = layout.zones.find((z) => z.family === "product")!;
    expect(product.h).toBeLessThan(before.h);
    const ys = visible.filter((n) => n.family === "product").map((n) => positions.get(n.id)!.y);
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(product.y);
    expect(Math.max(...ys)).toBeLessThan(product.y + product.h);
  });

  it("round-trips hidden entities and link mode in the URL", () => {
    const s = { ...DEFAULT_STATE, hidden: ["vakyam"], links: "all" as const };
    expect(parseState(new URLSearchParams(serializeState(s)))).toEqual(s);
    expect(serializeState(DEFAULT_STATE)).toBe("");
  });
});
