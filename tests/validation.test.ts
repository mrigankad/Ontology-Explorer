import { describe, expect, it } from "vitest";
import { DEMO_DATASET } from "@/lib/ontology/repository";
import { validateDataset, validateRelationship } from "@/lib/ontology/validation";
import type { Relationship } from "@/lib/ontology/types";

const entities = new Map(DEMO_DATASET.entities.map((e) => [e.id, e]));
const relTypes = new Map(DEMO_DATASET.relationTypes.map((r) => [r.id, r]));
const base: Relationship = { ...DEMO_DATASET.relationships[0] };

describe("relation validation", () => {
  it("accepts the seed dataset without issues", () => {
    expect(validateDataset(DEMO_DATASET)).toEqual([]);
  });

  it("rejects a disallowed subject type (an Industry cannot develop a Product)", () => {
    const issues = validateRelationship({ ...base, id: "x", subjectId: "mining", objectId: "vakyam" }, entities, relTypes);
    expect(issues.map((i) => i.code)).toContain("disallowed_subject_type");
  });

  it("rejects reversed direction (Product develops Organization)", () => {
    const issues = validateRelationship({ ...base, id: "x", subjectId: "vakyam", objectId: "wayam" }, entities, relTypes);
    expect(issues.map((i) => i.code)).toEqual(expect.arrayContaining(["disallowed_subject_type", "disallowed_object_type"]));
  });

  it("rejects orphan references and unknown predicates", () => {
    const issues = validateRelationship({ ...base, id: "x", subjectId: "ghost", relationTypeId: "haunts" }, entities, relTypes);
    expect(issues.map((i) => i.code)).toEqual(expect.arrayContaining(["orphan_subject", "unknown_relation"]));
  });

  it("flags orphan claim targets and bad locators", () => {
    const d = {
      ...DEMO_DATASET,
      claims: [...DEMO_DATASET.claims, { ...DEMO_DATASET.claims[0], id: "ce-x", target: { kind: "relationship" as const, id: "nope" } }],
      records: [
        ...DEMO_DATASET.records,
        { ...DEMO_DATASET.records[0], id: "rec-bad", locator: { type: "time" as const, startMs: 50, endMs: 10 } },
      ],
    };
    const codes = validateDataset(d).map((i) => i.code);
    expect(codes).toContain("orphan_claim_target");
    expect(codes).toContain("bad_locator");
  });

  it("keeps Industry and Client as distinct types and seeds no invented clients", () => {
    expect(entities.get("mining")?.typeId).toBe("Industry");
    expect(DEMO_DATASET.entities.some((e) => e.typeId === "ClientOrganization")).toBe(false);
  });
});
