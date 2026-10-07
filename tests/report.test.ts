import { describe, expect, it } from "vitest";
import { viewerFor } from "@/lib/ontology/access";
import { formatTrailReport, reportFilename, type TrailHop } from "@/lib/ontology/report";
import { DEMO_DATASET, OntologyRepository } from "@/lib/ontology/repository";

const repo = new OntologyRepository(DEMO_DATASET);
const v = viewerFor("analyst");

function hop(from: string, to: string, relId: string | null): TrailHop {
  const relationship = relId ? repo.getRelationship(v, relId) : null;
  const evidence = relId ? repo.listEvidence(v, { relationshipId: relId, limit: 50 }).items : [];
  return { from, to, relationship, evidence };
}

const base = {
  datasetLabel: "Wayam demo dataset",
  isDemo: true,
  viewUrl: "http://localhost/?node=bfsi",
  recordUrl: (id: string) => `http://localhost/records/${id}`,
  exportedAt: new Date("2026-09-25T10:00:00Z"),
};

describe("trail report", () => {
  const md = formatTrailReport({
    ...base,
    labels: ["Wayam.ai", "Pariksha"],
    hops: [hop("Wayam.ai", "Pariksha", "r-dev-pariksha")],
  });

  it("flags demo data and unsupported hops honestly", () => {
    expect(md).toContain("Demo data, not verified");
    expect(md).toContain("No evidence linked. This link is an unverified assertion.");
    expect(md).toContain("1 hop has no supporting evidence linked");
  });

  it("lists each evidence record with its exact locator and a record link", () => {
    const report = formatTrailReport({
      ...base,
      labels: ["Vakyam", "Call Analytics & QA", "BFSI"],
      hops: [hop("Vakyam", "Call Analytics & QA", "r-vk-call"), hop("Call Analytics & QA", "BFSI", "r-call-bfsi")],
    });
    expect(report).toContain("# Evidence trail: Vakyam → Call Analytics & QA → BFSI");
    expect(report).toContain("01:04–01:22 (agent)");
    expect(report).toContain("row 0142 of qa_scorecards");
    expect(report).toContain("http://localhost/records/rec-call-disclosure");
    expect(report).toContain("not yet reviewed");
    // Analyst can't see restricted evidence, and the report must not leak it.
    expect(report).not.toContain("rec-call-account");
  });

  it("reports disputed hops", () => {
    const report = formatTrailReport({ ...base, labels: ["Arjuna", "3D / Spatial AI"], hops: [hop("Arjuna", "3D / Spatial AI", "r-aj-spatial")] });
    expect(report).toContain("1 hop is disputed");
    expect(report).toContain("**Contradicts**");
  });

  it("builds safe file names", () => {
    expect(reportFilename(["Vakyam", "Call Analytics & QA"])).toBe("wayam-trail-vakyam-to-call-analytics-qa.md");
  });
});
