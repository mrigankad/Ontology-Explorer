/**
 * Shared domain + API contract types for the Wayam ontology explorer.
 *
 * Vocabulary:
 *  - a Relationship is an *assertion* (a claim that subject → predicate → object holds)
 *  - an EvidenceSource is the immutable *artifact* (file, recording, export)
 *  - an EvidenceRecord is a cited *fragment* of a source (page passage, time span, region, row)
 *  - a ClaimEvidence row explains how one fragment supports / contradicts / contextualises a claim
 */

export type FamilyId =
  | "company"
  | "product"
  | "capability"
  | "technology"
  | "data"
  | "solution"
  | "industry"
  | "stakeholder"
  | "client";

export type Classification = "public" | "internal" | "restricted";

/** Schema-level class, e.g. `Product`. Never an instance. */
export interface OntologyType {
  id: string;
  label: string;
  pluralLabel: string;
  description: string;
  parentId: string | null;
  family: FamilyId;
  /** Short glyph shown next to the type so colour is never the only cue. */
  glyph: string;
}

export type EntityStatus = "active" | "draft" | "deprecated";
export type Provenance = "reference-graphic" | "demo-fixture" | "curated";

/** Instance, e.g. `WayamEye` (type Product). */
export interface Entity {
  id: string;
  label: string;
  aliases: string[];
  typeId: string;
  description: string;
  properties: Record<string, string | number | boolean | null>;
  status: EntityStatus;
  /** `overview` entities appear on the opening graph; `detail` ones only load on expansion. */
  tier: "overview" | "detail";
  provenance: Provenance;
  classification: Classification;
  createdAt: string;
  updatedAt: string;
}

export interface RelationType {
  id: string;
  label: string;
  inverseLabel: string | null;
  subjectTypes: string[];
  objectTypes: string[];
  description: string;
}

export type AssertionStatus = "draft" | "verified" | "disputed" | "deprecated";

export interface Relationship {
  id: string;
  subjectId: string;
  relationTypeId: string;
  objectId: string;
  status: AssertionStatus;
  validFrom: string | null;
  validTo: string | null;
  createdBy: string;
  reviewedBy: string | null;
  provenance: Provenance;
  provenanceNote: string;
  classification: Classification;
  createdAt: string;
  updatedAt: string;
}

export type SourceKind = "document" | "image" | "audio" | "dataset" | "sensor";

export interface EvidenceSource {
  id: string;
  kind: SourceKind;
  title: string;
  uri: string;
  mimeType: string;
  checksum: string;
  acquiredAt: string;
  ingestedAt: string;
  classification: Classification;
  owner: string;
  /** Whether a previewable blob exists in storage. False → metadata fallback. */
  fileAvailable: boolean;
  isDemo: boolean;
  metadata: Record<string, string | number | boolean>;
}

export type Locator =
  | { type: "page"; page: number; lineStart: number; lineEnd: number }
  | { type: "time"; startMs: number; endMs: number; speaker?: string }
  | { type: "bbox"; x: number; y: number; w: number; h: number; imageW: number; imageH: number }
  | { type: "row"; table: string; key: string }
  | { type: "interval"; channel: string; start: string; end: string };

export type RecordKind =
  | "document_passage"
  | "transcript_segment"
  | "image_region"
  | "table_row"
  | "sensor_interval";

export interface Annotation {
  author: string;
  at: string;
  text: string;
}

export interface IngestEvent {
  at: string;
  event: string;
  detail: string;
}

export interface EvidenceRecord {
  id: string;
  sourceId: string;
  kind: RecordKind;
  title: string;
  content: string;
  payload: Record<string, string | number | boolean | null>;
  locator: Locator;
  extraction: { method: string; version: string; at: string };
  ingestStatus: "ingested" | "pending" | "failed";
  classification: Classification;
  annotations: Annotation[];
  ingestionHistory: IngestEvent[];
  isDemo: boolean;
  createdAt: string;
  updatedAt: string;
}

export type Stance = "supports" | "contradicts" | "context";
export type ReviewerDecision = "pending" | "accepted" | "rejected";

export type ClaimTarget =
  | { kind: "relationship"; id: string }
  | { kind: "entity"; id: string; property?: string };

export interface ClaimEvidence {
  id: string;
  target: ClaimTarget;
  evidenceRecordId: string;
  stance: Stance;
  excerpt: string;
  annotation: string;
  /** Extraction/model confidence. NOT factual verification. */
  confidence: number | null;
  reviewerDecision: ReviewerDecision;
  reviewer: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Dataset {
  id: string;
  label: string;
  isDemo: boolean;
  types: OntologyType[];
  relationTypes: RelationType[];
  entities: Entity[];
  relationships: Relationship[];
  sources: EvidenceSource[];
  records: EvidenceRecord[];
  claims: ClaimEvidence[];
}

// ---------------------------------------------------------------------------
// Access
// ---------------------------------------------------------------------------

export type ViewerRole = "analyst" | "admin";

export interface Viewer {
  id: string;
  role: ViewerRole;
  clearance: Classification[];
}

// ---------------------------------------------------------------------------
// API view models
// ---------------------------------------------------------------------------

export interface EvidenceCounts {
  supports: number;
  contradicts: number;
  context: number;
  /** Supporting links whose reviewer accepted them AND whose source is not a demo fixture. */
  verifiedSupports: number;
}

/** Derived, display-level state of a claim. */
export type EvidenceState = "verified" | "linked" | "none" | "disputed";

export interface EntitySummary {
  id: string;
  label: string;
  typeId: string;
  family: FamilyId;
  status: EntityStatus;
  tier: Entity["tier"];
  provenance: Provenance;
  evidence: EvidenceCounts;
  /** Number of relationships the viewer can see on this entity (loaded or not). */
  degree: number;
}

export interface EdgeSummary {
  id: string;
  subjectId: string;
  objectId: string;
  relationTypeId: string;
  label: string;
  status: AssertionStatus;
  provenance: Provenance;
  evidence: EvidenceCounts;
  evidenceState: EvidenceState;
}

export interface OverviewResponse {
  dataset: { id: string; label: string; isDemo: boolean };
  rootId: string;
  types: OntologyType[];
  relationTypes: RelationType[];
  nodes: EntitySummary[];
  edges: EdgeSummary[];
  familyCounts: Record<string, number>;
  /** Entities that exist but were left out of the bounded overview. */
  hiddenDetailCount: number;
}

export interface Page<T> {
  items: T[];
  total: number;
  nextCursor: string | null;
}

export interface LinkedEntity {
  edge: EdgeSummary;
  entity: EntitySummary;
  direction: "out" | "in";
}

export interface EntityDetail extends EntitySummary {
  aliases: string[];
  description: string;
  properties: Entity["properties"];
  classification: Classification;
  createdAt: string;
  updatedAt: string;
  type: OntologyType;
  /** Direct entity-level evidence counts (not through relationships). */
  directEvidence: EvidenceCounts;
  linked: LinkedEntity[];
}

export interface NeighborsResponse {
  centerId: string;
  depth: number;
  nodes: EntitySummary[];
  edges: EdgeSummary[];
  total: number;
  nextCursor: string | null;
}

export interface RelationshipDetail extends EdgeSummary {
  subject: EntitySummary;
  object: EntitySummary;
  relationType: RelationType;
  meaning: string;
  validFrom: string | null;
  validTo: string | null;
  createdBy: string;
  reviewedBy: string | null;
  provenanceNote: string;
  createdAt: string;
  updatedAt: string;
  /** Other claims between the same pair — kept distinct, never merged. */
  siblings: EdgeSummary[];
}

export interface EvidenceRow {
  linkId: string;
  record: {
    id: string;
    kind: RecordKind;
    title: string;
    content: string;
    locator: Locator;
    ingestStatus: EvidenceRecord["ingestStatus"];
    classification: Classification;
    isDemo: boolean;
    createdAt: string;
  };
  source: { id: string; title: string; kind: SourceKind; isDemo: boolean };
  claim: ClaimSummary;
  stance: Stance;
  excerpt: string;
  confidence: number | null;
  reviewerDecision: ReviewerDecision;
}

export type ClaimSummary =
  | {
      kind: "relationship";
      id: string;
      subject: { id: string; label: string };
      predicate: string;
      object: { id: string; label: string };
      status: AssertionStatus;
    }
  | { kind: "entity"; id: string; label: string; property: string | null };

export interface EvidenceQuery {
  entityId?: string;
  relationshipId?: string;
  kind?: RecordKind;
  stance?: Stance;
  sourceId?: string;
  query?: string;
  from?: string;
  to?: string;
  sort?: EvidenceSort;
  cursor?: string | null;
  limit?: number;
}

export type EvidenceSort =
  | "created_desc"
  | "created_asc"
  | "title_asc"
  | "kind_asc"
  | "stance_asc";

export interface EvidenceRecordDetail {
  record: EvidenceRecord;
  source: EvidenceSource;
  links: Array<{
    linkId: string;
    claim: ClaimSummary;
    stance: Stance;
    excerpt: string;
    annotation: string;
    confidence: number | null;
    reviewerDecision: ReviewerDecision;
    reviewer: string | null;
  }>;
  /** Neighbouring records from the same source, for context navigation. */
  siblings: Array<{ id: string; title: string; locator: Locator }>;
}

export interface SourcePreview {
  sourceId: string;
  kind: SourceKind;
  available: boolean;
  reason?: string;
  /** Sanitised, renderable preview payload. Shape depends on kind. */
  pages?: Array<{ page: number; lines: string[] }>;
  scene?: { width: number; height: number; description: string };
  transcript?: Array<{ startMs: number; endMs: number; speaker: string; text: string; redacted: boolean }>;
  durationMs?: number;
  table?: { columns: string[]; rows: Array<Record<string, string | number | boolean>> };
  series?: { channel: string; unit: string; points: Array<{ t: string; v: number }> };
}
