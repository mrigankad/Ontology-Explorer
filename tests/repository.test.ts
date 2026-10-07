import { describe, expect, it } from "vitest";
import { viewerFor } from "@/lib/ontology/access";
import { DEMO_DATASET, OntologyRepository, decodeCursor, encodeCursor } from "@/lib/ontology/repository";
import type { FamilyId } from "@/lib/ontology/types";

const repo = new OntologyRepository(DEMO_DATASET);
const analyst = viewerFor("analyst");
const admin = viewerFor("admin");

describe("overview", () => {
  it("returns the root, all seven families and no detail-tier entities", () => {
    const o = repo.overview(analyst);
    expect(o.rootId).toBe("wayam");
    const fams = new Set(o.nodes.map((n) => n.family));
    const expected: FamilyId[] = ["company", "product", "capability", "technology", "data", "solution", "industry", "stakeholder"];
    for (const f of expected) expect(fams.has(f)).toBe(true);
    expect(o.nodes.some((n) => n.tier === "detail")).toBe(false);
    expect(o.hiddenDetailCount).toBeGreaterThan(0);
    const ids = new Set(o.nodes.map((n) => n.id));
    expect(o.edges.every((e) => ids.has(e.subjectId) && ids.has(e.objectId))).toBe(true);
  });
});

describe("search", () => {
  it("finds Vakyam by label and Computer Vision by alias", () => {
    expect(repo.searchEntities(analyst, { query: "vakyam" }).items[0].id).toBe("vakyam");
    const cv = repo.searchEntities(analyst, { query: "vision ai" }).items[0];
    expect(cv.id).toBe("computer-vision");
    expect(cv.matched).toBe("Vision AI");
  });
});

describe("pagination", () => {
  it("round-trips cursors and rejects garbage", () => {
    expect(decodeCursor(encodeCursor(7))).toBe(7);
    expect(decodeCursor("not-a-cursor")).toBe(0);
  });

  it("pages through entities without duplicates", () => {
    const seen: string[] = [];
    let cursor: string | null = null;
    do {
      const page = repo.searchEntities(analyst, { limit: 10, cursor });
      seen.push(...page.items.map((i) => i.id));
      cursor = page.nextCursor;
    } while (cursor);
    expect(seen.length).toBe(DEMO_DATASET.entities.length);
    expect(new Set(seen).size).toBe(seen.length);
  });
});

describe("traversal", () => {
  it("is bounded by depth and handles cycles", () => {
    const d1 = repo.neighbors(analyst, "computer-vision", { depth: 1, limit: 50 })!;
    const d3 = repo.neighbors(analyst, "computer-vision", { depth: 3, limit: 50 })!;
    expect(d3.total).toBeGreaterThan(d1.total);
    expect(new Set(d3.edges.map((e) => e.id)).size).toBe(d3.edges.length);
    expect(repo.neighbors(analyst, "computer-vision", { depth: 99 })!.depth).toBe(3);
  });

  it("reveals detail-tier children when expanding a capability", () => {
    const n = repo.neighbors(analyst, "computer-vision", { direction: "in", relations: ["part_of"] })!;
    expect(n.nodes.map((x) => x.id)).toEqual(expect.arrayContaining(["object-detection", "ppe-detection", "ocr"]));
  });

  it("paginates neighbours", () => {
    const first = repo.neighbors(analyst, "wayam", { depth: 2, limit: 3 })!;
    expect(first.edges.length).toBe(3);
    expect(first.nextCursor).not.toBeNull();
    const second = repo.neighbors(analyst, "wayam", { depth: 2, limit: 3, cursor: first.nextCursor })!;
    expect(second.edges.map((e) => e.id)).not.toContain(first.edges[0].id);
  });
});

describe("evidence linkage", () => {
  it("links Vakyam supports Call Analytics to a transcript segment and a QA row", () => {
    const rows = repo.listEvidence(analyst, { relationshipId: "r-vk-call", limit: 50 }).items;
    expect(rows.map((r) => r.record.id).sort()).toEqual(["rec-call-disclosure", "rec-qa-0142"]);
    expect(rows.every((r) => r.claim.kind === "relationship" && r.claim.id === "r-vk-call")).toBe(true);
  });

  it("reports honest missing evidence for an unsourced claim and node", () => {
    const rel = repo.getRelationship(analyst, "r-dev-pariksha")!;
    expect(rel.evidenceState).toBe("none");
    expect(rel.evidence.supports).toBe(0);
    const node = repo.getEntity(analyst, "government")!;
    expect(node.evidence.supports + node.evidence.context + node.evidence.contradicts).toBe(0);
  });

  it("never counts demo evidence as verified", () => {
    for (const e of repo.overview(admin).edges) {
      expect(e.evidence.verifiedSupports).toBe(0);
      expect(e.evidenceState).not.toBe("verified");
    }
  });

  it("marks contradicted claims as disputed", () => {
    expect(repo.getRelationship(analyst, "r-aj-spatial")!.evidenceState).toBe("disputed");
  });

  it("returns every claim a record bears on", () => {
    const d = repo.getEvidenceRecord(analyst, "rec-catalogue-p1")!;
    expect(d.links.map((l) => l.claim.id).sort()).toEqual(["r-dev-sutradhar", "r-dev-vakyam", "r-dev-wayameye"]);
  });

  it("filters the evidence table by stance, kind and text", () => {
    expect(repo.listEvidence(analyst, { stance: "contradicts" }).items.map((r) => r.record.id)).toEqual(["rec-roadmap-note"]);
    expect(repo.listEvidence(analyst, { kind: "image_region", limit: 50 }).items.every((r) => r.record.kind === "image_region")).toBe(true);
    expect(repo.listEvidence(analyst, { query: "DISC-03" }).total).toBe(0);
    expect(repo.listEvidence(analyst, { query: "fee disclosure" }).total).toBeGreaterThan(0);
  });
});

describe("permission filtering", () => {
  it("hides restricted records from analysts, including by direct id", () => {
    expect(repo.getEvidenceRecord(analyst, "rec-call-account")).toBeNull();
    expect(repo.getEvidenceRecord(analyst, "rec-vibration-spike")).toBeNull();
    expect(repo.getEvidenceRecord(admin, "rec-call-account")).not.toBeNull();
  });

  it("excludes restricted evidence from counts and tables", () => {
    expect(repo.getRelationship(analyst, "r-call-bfsi")!.evidence.supports).toBe(1);
    expect(repo.getRelationship(admin, "r-call-bfsi")!.evidence.supports).toBe(2);
    const rows = repo.listEvidence(analyst, { limit: 50 }).items;
    expect(rows.some((r) => r.record.classification === "restricted")).toBe(false);
    expect(repo.getRelationship(analyst, "r-quality-mfg")!.evidenceState).toBe("none");
  });

  it("blocks previews of restricted sources and redacts restricted transcript segments", () => {
    expect(repo.sourcePreview(analyst, "src-demo-vibration")).toBeNull();
    const call = repo.sourcePreview(analyst, "src-demo-call")!;
    expect(call.available).toBe(false);
    const seg = call.transcript!.find((s) => s.startMs === 130000)!;
    expect(seg.redacted).toBe(true);
    expect(seg.text).not.toMatch(/Account identifiers/);
  });
});
