import { canSee } from "./access";
import { ENTITIES, RELATIONSHIPS } from "./seed/entities";
import { CLAIMS, PREVIEWS, RECORDS, SOURCES } from "./seed/evidence";
import { ONTOLOGY_TYPES, RELATION_TYPES } from "./seed/schema";
import type {
  ClaimEvidence,
  ClaimSummary,
  Dataset,
  EdgeSummary,
  Entity,
  EntityDetail,
  EntitySummary,
  EvidenceCounts,
  EvidenceQuery,
  EvidenceRecord,
  EvidenceRecordDetail,
  EvidenceRow,
  EvidenceSource,
  EvidenceState,
  LinkedEntity,
  NeighborsResponse,
  OntologyType,
  OverviewResponse,
  Page,
  Relationship,
  RelationshipDetail,
  RelationType,
  SourcePreview,
  Viewer,
} from "./types";

export const MAX_DEPTH = 3;
export const MAX_LIMIT = 50;
export const DEFAULT_NEIGHBOR_LIMIT = 24;
export const DEFAULT_EVIDENCE_LIMIT = 10;

export function encodeCursor(offset: number): string {
  return Buffer.from(`o:${offset}`).toString("base64url");
}

export function decodeCursor(cursor: string | null | undefined): number {
  if (!cursor) return 0;
  try {
    const raw = Buffer.from(cursor, "base64url").toString();
    const n = Number(raw.startsWith("o:") ? raw.slice(2) : NaN);
    return Number.isInteger(n) && n >= 0 ? n : 0;
  } catch {
    return 0;
  }
}

function paginate<T>(items: T[], cursor: string | null | undefined, limit: number): Page<T> {
  const offset = decodeCursor(cursor);
  const size = Math.max(1, Math.min(limit, MAX_LIMIT));
  const slice = items.slice(offset, offset + size);
  const next = offset + size < items.length ? encodeCursor(offset + size) : null;
  return { items: slice, total: items.length, nextCursor: next };
}

const EMPTY_COUNTS: EvidenceCounts = { supports: 0, contradicts: 0, context: 0, verifiedSupports: 0 };

/**
 * Read model over a Dataset. Indexes play the role that database indexes would
 * (id lookups, adjacency lists, evidence joins). Swap for SQL-backed
 * implementations of the same methods when a real store exists.
 */
export class OntologyRepository {
  private entities: Map<string, Entity>;
  private types: Map<string, OntologyType>;
  private relTypes: Map<string, RelationType>;
  private rels: Map<string, Relationship>;
  private out = new Map<string, Relationship[]>();
  private inc = new Map<string, Relationship[]>();
  private sources: Map<string, EvidenceSource>;
  private records: Map<string, EvidenceRecord>;
  private claimsByRel = new Map<string, ClaimEvidence[]>();
  private claimsByEntity = new Map<string, ClaimEvidence[]>();
  private claimsByRecord = new Map<string, ClaimEvidence[]>();

  constructor(readonly dataset: Dataset) {
    this.entities = new Map(dataset.entities.map((e) => [e.id, e]));
    this.types = new Map(dataset.types.map((t) => [t.id, t]));
    this.relTypes = new Map(dataset.relationTypes.map((r) => [r.id, r]));
    this.rels = new Map(dataset.relationships.map((r) => [r.id, r]));
    this.sources = new Map(dataset.sources.map((s) => [s.id, s]));
    this.records = new Map(dataset.records.map((r) => [r.id, r]));
    const push = <K, V>(m: Map<K, V[]>, k: K, v: V) => {
      const list = m.get(k);
      if (list) list.push(v);
      else m.set(k, [v]);
    };
    for (const r of dataset.relationships) {
      push(this.out, r.subjectId, r);
      push(this.inc, r.objectId, r);
    }
    for (const c of dataset.claims) {
      push(c.target.kind === "relationship" ? this.claimsByRel : this.claimsByEntity, c.target.id, c);
      push(this.claimsByRecord, c.evidenceRecordId, c);
    }
  }

  // -------------------------------------------------------------------------
  // Visibility
  // -------------------------------------------------------------------------

  private entityVisible(v: Viewer, id: string): boolean {
    const e = this.entities.get(id);
    return !!e && canSee(v, e.classification);
  }

  private relVisible(v: Viewer, r: Relationship): boolean {
    return canSee(v, r.classification) && this.entityVisible(v, r.subjectId) && this.entityVisible(v, r.objectId);
  }

  private recordVisible(v: Viewer, recordId: string): boolean {
    const rec = this.records.get(recordId);
    if (!rec || !canSee(v, rec.classification)) return false;
    const src = this.sources.get(rec.sourceId);
    return !!src && canSee(v, src.classification);
  }

  private claimVisible(v: Viewer, c: ClaimEvidence): boolean {
    if (!this.recordVisible(v, c.evidenceRecordId)) return false;
    if (c.target.kind === "relationship") {
      const r = this.rels.get(c.target.id);
      return !!r && this.relVisible(v, r);
    }
    return this.entityVisible(v, c.target.id);
  }

  // -------------------------------------------------------------------------
  // Summaries
  // -------------------------------------------------------------------------

  private count(v: Viewer, claims: ClaimEvidence[] | undefined): EvidenceCounts {
    if (!claims?.length) return EMPTY_COUNTS;
    const c = { ...EMPTY_COUNTS };
    for (const cl of claims) {
      if (!this.claimVisible(v, cl)) continue;
      c[cl.stance] += 1;
      const rec = this.records.get(cl.evidenceRecordId)!;
      const src = this.sources.get(rec.sourceId)!;
      if (cl.stance === "supports" && cl.reviewerDecision === "accepted" && !rec.isDemo && !src.isDemo) {
        c.verifiedSupports += 1;
      }
    }
    return c;
  }

  static evidenceState(status: Relationship["status"], c: EvidenceCounts): EvidenceState {
    if (status === "disputed" || c.contradicts > 0) return "disputed";
    if (status === "verified" && c.verifiedSupports > 0) return "verified";
    if (c.supports > 0) return "linked";
    return "none";
  }

  private edgeSummary(v: Viewer, r: Relationship): EdgeSummary {
    const evidence = this.count(v, this.claimsByRel.get(r.id));
    return {
      id: r.id,
      subjectId: r.subjectId,
      objectId: r.objectId,
      relationTypeId: r.relationTypeId,
      label: this.relTypes.get(r.relationTypeId)?.label ?? r.relationTypeId,
      status: r.status,
      provenance: r.provenance,
      evidence,
      evidenceState: OntologyRepository.evidenceState(r.status, evidence),
    };
  }

  private entitySummary(v: Viewer, e: Entity): EntitySummary {
    const incident = [...(this.out.get(e.id) ?? []), ...(this.inc.get(e.id) ?? [])].filter((r) => this.relVisible(v, r));
    const claims = [...(this.claimsByEntity.get(e.id) ?? []), ...incident.flatMap((r) => this.claimsByRel.get(r.id) ?? [])];
    return {
      id: e.id,
      label: e.label,
      typeId: e.typeId,
      family: this.types.get(e.typeId)?.family ?? "company",
      status: e.status,
      tier: e.tier,
      provenance: e.provenance,
      evidence: this.count(v, claims),
      degree: incident.length,
    };
  }

  private claimSummary(c: ClaimEvidence): ClaimSummary {
    if (c.target.kind === "relationship") {
      const r = this.rels.get(c.target.id)!;
      return {
        kind: "relationship",
        id: r.id,
        subject: { id: r.subjectId, label: this.entities.get(r.subjectId)?.label ?? r.subjectId },
        predicate: this.relTypes.get(r.relationTypeId)?.label ?? r.relationTypeId,
        object: { id: r.objectId, label: this.entities.get(r.objectId)?.label ?? r.objectId },
        status: r.status,
      };
    }
    const e = this.entities.get(c.target.id)!;
    return { kind: "entity", id: e.id, label: e.label, property: c.target.property ?? null };
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  overview(v: Viewer): OverviewResponse {
    const visible = this.dataset.entities.filter((e) => canSee(v, e.classification));
    const nodes = visible.filter((e) => e.tier === "overview");
    const ids = new Set(nodes.map((n) => n.id));
    const edges = this.dataset.relationships.filter(
      (r) => ids.has(r.subjectId) && ids.has(r.objectId) && this.relVisible(v, r),
    );
    const familyCounts: Record<string, number> = {};
    for (const e of visible) {
      const fam = this.types.get(e.typeId)?.family ?? "company";
      familyCounts[fam] = (familyCounts[fam] ?? 0) + 1;
    }
    return {
      dataset: { id: this.dataset.id, label: this.dataset.label, isDemo: this.dataset.isDemo },
      rootId: "wayam",
      types: this.dataset.types,
      relationTypes: this.dataset.relationTypes,
      nodes: nodes.map((e) => this.entitySummary(v, e)),
      edges: edges.map((r) => this.edgeSummary(v, r)),
      familyCounts,
      hiddenDetailCount: visible.length - nodes.length,
    };
  }

  searchEntities(
    v: Viewer,
    opts: { query?: string; type?: string; cursor?: string | null; limit?: number },
  ): Page<EntitySummary & { matched: string | null }> {
    const q = opts.query?.trim().toLowerCase() ?? "";
    const scored: Array<{ e: Entity; score: number; matched: string | null }> = [];
    for (const e of this.dataset.entities) {
      if (!canSee(v, e.classification)) continue;
      if (opts.type && e.typeId !== opts.type) continue;
      if (!q) {
        scored.push({ e, score: 0, matched: null });
        continue;
      }
      const label = e.label.toLowerCase();
      let score = -1;
      let matched: string | null = null;
      if (label === q || e.id === q) score = 100;
      else if (label.startsWith(q)) score = 80;
      else if (label.includes(q)) score = 60;
      else if (e.id.includes(q)) score = 50;
      else {
        const alias = e.aliases.find((a) => a.toLowerCase().includes(q));
        if (alias) {
          score = alias.toLowerCase() === q ? 70 : 40;
          matched = alias;
        }
      }
      if (score >= 0) scored.push({ e, score, matched });
    }
    scored.sort((a, b) => b.score - a.score || a.e.label.localeCompare(b.e.label));
    const page = paginate(scored, opts.cursor, opts.limit ?? 20);
    return { ...page, items: page.items.map((s) => ({ ...this.entitySummary(v, s.e), matched: s.matched })) };
  }

  getEntity(v: Viewer, id: string): EntityDetail | null {
    const e = this.entities.get(id);
    if (!e || !canSee(v, e.classification)) return null;
    const linked: LinkedEntity[] = [];
    for (const r of this.out.get(id) ?? []) {
      if (this.relVisible(v, r)) linked.push({ edge: this.edgeSummary(v, r), entity: this.entitySummary(v, this.entities.get(r.objectId)!), direction: "out" });
    }
    for (const r of this.inc.get(id) ?? []) {
      if (this.relVisible(v, r)) linked.push({ edge: this.edgeSummary(v, r), entity: this.entitySummary(v, this.entities.get(r.subjectId)!), direction: "in" });
    }
    return {
      ...this.entitySummary(v, e),
      aliases: e.aliases,
      description: e.description,
      properties: e.properties,
      classification: e.classification,
      createdAt: e.createdAt,
      updatedAt: e.updatedAt,
      type: this.types.get(e.typeId)!,
      directEvidence: this.count(v, this.claimsByEntity.get(e.id)),
      linked,
    };
  }

  /** Bounded BFS. Cycles are handled by the visited set; results paginate over edges. */
  neighbors(
    v: Viewer,
    id: string,
    opts: { direction?: "out" | "in" | "both"; relations?: string[]; depth?: number; cursor?: string | null; limit?: number },
  ): NeighborsResponse | null {
    if (!this.entityVisible(v, id)) return null;
    const depth = Math.max(1, Math.min(opts.depth ?? 1, MAX_DEPTH));
    const dir = opts.direction ?? "both";
    const relFilter = opts.relations?.length ? new Set(opts.relations) : null;
    const visited = new Set([id]);
    const edgeIds = new Set<string>();
    const edges: Relationship[] = [];
    let frontier = [id];
    for (let d = 0; d < depth && frontier.length; d++) {
      const next: string[] = [];
      for (const nid of frontier) {
        const cand = [
          ...(dir !== "in" ? (this.out.get(nid) ?? []).map((r) => [r, r.objectId] as const) : []),
          ...(dir !== "out" ? (this.inc.get(nid) ?? []).map((r) => [r, r.subjectId] as const) : []),
        ];
        for (const [r, other] of cand) {
          if (relFilter && !relFilter.has(r.relationTypeId)) continue;
          if (!this.relVisible(v, r) || edgeIds.has(r.id)) continue;
          edgeIds.add(r.id);
          edges.push(r);
          if (!visited.has(other)) {
            visited.add(other);
            next.push(other);
          }
        }
      }
      frontier = next;
    }
    const page = paginate(edges, opts.cursor, opts.limit ?? DEFAULT_NEIGHBOR_LIMIT);
    const nodeIds = new Set([id]);
    for (const r of page.items) {
      nodeIds.add(r.subjectId);
      nodeIds.add(r.objectId);
    }
    return {
      centerId: id,
      depth,
      nodes: [...nodeIds].map((n) => this.entitySummary(v, this.entities.get(n)!)),
      edges: page.items.map((r) => this.edgeSummary(v, r)),
      total: page.total,
      nextCursor: page.nextCursor,
    };
  }

  getRelationship(v: Viewer, id: string): RelationshipDetail | null {
    const r = this.rels.get(id);
    if (!r || !this.relVisible(v, r)) return null;
    const rt = this.relTypes.get(r.relationTypeId)!;
    const subject = this.entities.get(r.subjectId)!;
    const object = this.entities.get(r.objectId)!;
    const siblings = [...(this.out.get(r.subjectId) ?? []), ...(this.inc.get(r.subjectId) ?? [])]
      .filter(
        (o) =>
          o.id !== r.id &&
          ((o.subjectId === r.subjectId && o.objectId === r.objectId) || (o.subjectId === r.objectId && o.objectId === r.subjectId)) &&
          this.relVisible(v, o),
      )
      .map((o) => this.edgeSummary(v, o));
    return {
      ...this.edgeSummary(v, r),
      subject: this.entitySummary(v, subject),
      object: this.entitySummary(v, object),
      relationType: rt,
      meaning: `${subject.label} ${rt.label} ${object.label}. ${rt.description}`,
      validFrom: r.validFrom,
      validTo: r.validTo,
      createdBy: r.createdBy,
      reviewedBy: r.reviewedBy,
      provenanceNote: r.provenanceNote,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      siblings,
    };
  }

  listEvidence(v: Viewer, q: EvidenceQuery): Page<EvidenceRow> {
    let claims: ClaimEvidence[];
    if (q.relationshipId) {
      claims = this.claimsByRel.get(q.relationshipId) ?? [];
    } else if (q.entityId) {
      const incident = [...(this.out.get(q.entityId) ?? []), ...(this.inc.get(q.entityId) ?? [])];
      claims = [...(this.claimsByEntity.get(q.entityId) ?? []), ...incident.flatMap((r) => this.claimsByRel.get(r.id) ?? [])];
    } else {
      claims = this.dataset.claims;
    }
    const text = q.query?.trim().toLowerCase();
    const rows: EvidenceRow[] = [];
    for (const c of claims) {
      if (!this.claimVisible(v, c)) continue;
      if (q.stance && c.stance !== q.stance) continue;
      const rec = this.records.get(c.evidenceRecordId)!;
      if (q.kind && rec.kind !== q.kind) continue;
      if (q.sourceId && rec.sourceId !== q.sourceId) continue;
      if (q.from && rec.createdAt < q.from) continue;
      if (q.to && rec.createdAt > q.to) continue;
      const src = this.sources.get(rec.sourceId)!;
      const claim = this.claimSummary(c);
      if (text) {
        const hay = [rec.title, rec.content, c.excerpt, src.title, claim.kind === "relationship" ? `${claim.subject.label} ${claim.predicate} ${claim.object.label}` : claim.label]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(text)) continue;
      }
      rows.push({
        linkId: c.id,
        record: {
          id: rec.id,
          kind: rec.kind,
          title: rec.title,
          content: rec.content,
          locator: rec.locator,
          ingestStatus: rec.ingestStatus,
          classification: rec.classification,
          isDemo: rec.isDemo,
          createdAt: rec.createdAt,
        },
        source: { id: src.id, title: src.title, kind: src.kind, isDemo: src.isDemo },
        claim,
        stance: c.stance,
        excerpt: c.excerpt,
        confidence: c.confidence,
        reviewerDecision: c.reviewerDecision,
      });
    }
    const sort = q.sort ?? "created_desc";
    const by: Record<string, (a: EvidenceRow, b: EvidenceRow) => number> = {
      created_desc: (a, b) => b.record.createdAt.localeCompare(a.record.createdAt) || a.linkId.localeCompare(b.linkId),
      created_asc: (a, b) => a.record.createdAt.localeCompare(b.record.createdAt) || a.linkId.localeCompare(b.linkId),
      title_asc: (a, b) => a.record.title.localeCompare(b.record.title) || a.linkId.localeCompare(b.linkId),
      kind_asc: (a, b) => a.record.kind.localeCompare(b.record.kind) || a.linkId.localeCompare(b.linkId),
      stance_asc: (a, b) => a.stance.localeCompare(b.stance) || a.linkId.localeCompare(b.linkId),
    };
    rows.sort(by[sort] ?? by.created_desc);
    return paginate(rows, q.cursor, q.limit ?? DEFAULT_EVIDENCE_LIMIT);
  }

  /** Returns null for missing *and* forbidden records so direct URLs can't probe existence. */
  getEvidenceRecord(v: Viewer, id: string): EvidenceRecordDetail | null {
    if (!this.recordVisible(v, id)) return null;
    const record = this.records.get(id)!;
    const source = this.sources.get(record.sourceId)!;
    const links = (this.claimsByRecord.get(id) ?? [])
      .filter((c) => this.claimVisible(v, c))
      .map((c) => ({
        linkId: c.id,
        claim: this.claimSummary(c),
        stance: c.stance,
        excerpt: c.excerpt,
        annotation: c.annotation,
        confidence: c.confidence,
        reviewerDecision: c.reviewerDecision,
        reviewer: c.reviewer,
      }));
    const siblings = this.dataset.records
      .filter((r) => r.sourceId === source.id && r.id !== id && this.recordVisible(v, r.id))
      .map((r) => ({ id: r.id, title: r.title, locator: r.locator }));
    return { record, source, links, siblings };
  }

  sourcePreview(v: Viewer, sourceId: string): SourcePreview | null {
    const src = this.sources.get(sourceId);
    if (!src || !canSee(v, src.classification)) return null;
    const raw = PREVIEWS[sourceId] ?? {};
    const restrictedOk = canSee(v, "restricted");
    const preview: SourcePreview = {
      sourceId,
      kind: src.kind,
      available: src.fileAvailable,
      reason: src.fileAvailable ? undefined : "The original file is not in storage for this dataset. Derived records are shown instead.",
      ...raw,
    };
    if (preview.transcript) {
      preview.transcript = preview.transcript.map((s) =>
        s.redacted && !restrictedOk ? { ...s, text: "Redacted. This segment needs restricted clearance." } : { ...s, redacted: s.redacted && !restrictedOk },
      );
    }
    return preview;
  }
}

export const DEMO_DATASET: Dataset = {
  id: "wayam-demo",
  label: "Wayam demo dataset",
  isDemo: true,
  types: ONTOLOGY_TYPES,
  relationTypes: RELATION_TYPES,
  entities: ENTITIES,
  relationships: RELATIONSHIPS,
  sources: SOURCES,
  records: RECORDS,
  claims: CLAIMS,
};

let repo: OntologyRepository | null = null;
export function getRepository(): OntologyRepository {
  repo ??= new OntologyRepository(DEMO_DATASET);
  return repo;
}
