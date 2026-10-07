import type { ClaimEvidence, Dataset, Entity, EvidenceRecord, Relationship, RelationType } from "./types";

export interface ValidationIssue {
  code:
    | "duplicate_id"
    | "unknown_type"
    | "unknown_relation"
    | "orphan_subject"
    | "orphan_object"
    | "disallowed_subject_type"
    | "disallowed_object_type"
    | "self_loop"
    | "orphan_source"
    | "orphan_record"
    | "orphan_claim_target"
    | "bad_locator"
    | "invalid_interval";
  id: string;
  message: string;
}

/** Validate a single relationship against its relation type and the entity index. */
export function validateRelationship(
  r: Relationship,
  entities: Map<string, Entity>,
  relationTypes: Map<string, RelationType>,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const rt = relationTypes.get(r.relationTypeId);
  const s = entities.get(r.subjectId);
  const o = entities.get(r.objectId);
  if (!rt) issues.push({ code: "unknown_relation", id: r.id, message: `Unknown relation type "${r.relationTypeId}"` });
  if (!s) issues.push({ code: "orphan_subject", id: r.id, message: `Subject "${r.subjectId}" does not exist` });
  if (!o) issues.push({ code: "orphan_object", id: r.id, message: `Object "${r.objectId}" does not exist` });
  if (r.subjectId === r.objectId) issues.push({ code: "self_loop", id: r.id, message: "Subject and object are the same entity" });
  if (rt && s && !rt.subjectTypes.includes(s.typeId)) {
    issues.push({
      code: "disallowed_subject_type",
      id: r.id,
      message: `"${rt.id}" does not allow a ${s.typeId} subject (allowed: ${rt.subjectTypes.join(", ")})`,
    });
  }
  if (rt && o && !rt.objectTypes.includes(o.typeId)) {
    issues.push({
      code: "disallowed_object_type",
      id: r.id,
      message: `"${rt.id}" does not allow a ${o.typeId} object (allowed: ${rt.objectTypes.join(", ")})`,
    });
  }
  if (r.validFrom && r.validTo && r.validFrom > r.validTo) {
    issues.push({ code: "invalid_interval", id: r.id, message: "validFrom is after validTo" });
  }
  return issues;
}

function validateLocator(rec: EvidenceRecord): ValidationIssue | null {
  const l = rec.locator;
  const bad = (m: string): ValidationIssue => ({ code: "bad_locator", id: rec.id, message: m });
  switch (l.type) {
    case "page":
      return l.page < 1 || l.lineStart > l.lineEnd ? bad("Page locator out of range") : null;
    case "time":
      return l.startMs < 0 || l.startMs >= l.endMs ? bad("Time locator must have start < end") : null;
    case "bbox":
      return l.x < 0 || l.y < 0 || l.x + l.w > l.imageW || l.y + l.h > l.imageH ? bad("Bounding box outside image") : null;
    case "row":
      return l.key ? null : bad("Row locator needs a key");
    case "interval":
      return l.start >= l.end ? bad("Interval must have start < end") : null;
  }
}

/** Full-dataset integrity check. Used by tests and by the import adapter before commit. */
export function validateDataset(d: Dataset): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const dupes = (items: { id: string }[]) => {
    const seen = new Set<string>();
    for (const i of items) {
      if (seen.has(i.id)) issues.push({ code: "duplicate_id", id: i.id, message: `Duplicate id "${i.id}"` });
      seen.add(i.id);
    }
  };
  dupes(d.entities);
  dupes(d.relationships);
  dupes(d.sources);
  dupes(d.records);
  dupes(d.claims);

  const typeIds = new Set(d.types.map((t) => t.id));
  const entities = new Map(d.entities.map((e) => [e.id, e]));
  const relTypes = new Map(d.relationTypes.map((r) => [r.id, r]));
  const sources = new Set(d.sources.map((s) => s.id));
  const records = new Set(d.records.map((r) => r.id));
  const relIds = new Set(d.relationships.map((r) => r.id));

  for (const e of d.entities) {
    if (!typeIds.has(e.typeId)) issues.push({ code: "unknown_type", id: e.id, message: `Unknown type "${e.typeId}"` });
  }
  for (const r of d.relationships) issues.push(...validateRelationship(r, entities, relTypes));
  for (const rec of d.records) {
    if (!sources.has(rec.sourceId)) issues.push({ code: "orphan_source", id: rec.id, message: `Source "${rec.sourceId}" does not exist` });
    const li = validateLocator(rec);
    if (li) issues.push(li);
  }
  for (const c of d.claims) issues.push(...validateClaim(c, records, relIds, entities));
  return issues;
}

function validateClaim(
  c: ClaimEvidence,
  records: Set<string>,
  relIds: Set<string>,
  entities: Map<string, Entity>,
): ValidationIssue[] {
  const out: ValidationIssue[] = [];
  if (!records.has(c.evidenceRecordId)) {
    out.push({ code: "orphan_record", id: c.id, message: `Record "${c.evidenceRecordId}" does not exist` });
  }
  const ok = c.target.kind === "relationship" ? relIds.has(c.target.id) : entities.has(c.target.id);
  if (!ok) out.push({ code: "orphan_claim_target", id: c.id, message: `Claim target "${c.target.id}" does not exist` });
  return out;
}
