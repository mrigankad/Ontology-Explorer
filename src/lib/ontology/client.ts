import type {
  EntityDetail,
  EntitySummary,
  EvidenceQuery,
  EvidenceRecordDetail,
  EvidenceRow,
  NeighborsResponse,
  OverviewResponse,
  Page,
  RelationshipDetail,
  SourcePreview,
} from "./types";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export type SearchResult = EntitySummary & { matched: string | null };

export interface NeighborOptions {
  direction?: "in" | "out" | "both";
  relations?: string[];
  depth?: number;
  cursor?: string | null;
  limit?: number;
}

/**
 * Everything the explorer needs from a backend. The UI only talks to this
 * interface, so a GraphQL client, an in-memory fixture or a different REST
 * shape can be dropped in without touching components.
 */
export interface OntologyDataAdapter {
  overview(signal?: AbortSignal): Promise<OverviewResponse>;
  search(query: string, opts?: { type?: string; limit?: number }, signal?: AbortSignal): Promise<Page<SearchResult>>;
  entity(id: string, signal?: AbortSignal): Promise<EntityDetail>;
  neighbors(id: string, opts: NeighborOptions, signal?: AbortSignal): Promise<NeighborsResponse>;
  relationship(id: string, signal?: AbortSignal): Promise<RelationshipDetail>;
  evidence(q: EvidenceQuery, signal?: AbortSignal): Promise<Page<EvidenceRow>>;
  record(id: string, signal?: AbortSignal): Promise<EvidenceRecordDetail>;
  preview(sourceId: string, signal?: AbortSignal): Promise<SourcePreview>;
}

function qs(params: Record<string, string | number | null | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== "") sp.set(k, String(v));
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export function createHttpAdapter(base = "/api/ontology"): OntologyDataAdapter {
  async function get<T>(path: string, signal?: AbortSignal): Promise<T> {
    const res = await fetch(`${base}${path}`, { signal, headers: { accept: "application/json" } });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { message?: string } | null;
      throw new ApiError(res.status, body?.message ?? `Request failed with status ${res.status}`);
    }
    return (await res.json()) as T;
  }
  const enc = encodeURIComponent;
  return {
    overview: (signal) => get("/overview", signal),
    search: (query, opts, signal) => get(`/entities${qs({ query, type: opts?.type, limit: opts?.limit })}`, signal),
    entity: (id, signal) => get(`/entities/${enc(id)}`, signal),
    neighbors: (id, o, signal) =>
      get(
        `/entities/${enc(id)}/neighbors${qs({
          direction: o.direction,
          relation: o.relations?.join(","),
          depth: o.depth,
          cursor: o.cursor,
          limit: o.limit,
        })}`,
        signal,
      ),
    relationship: (id, signal) => get(`/relationships/${enc(id)}`, signal),
    evidence: (q, signal) =>
      get(
        `/evidence${qs({
          entityId: q.entityId,
          relationshipId: q.relationshipId,
          kind: q.kind,
          stance: q.stance,
          sourceId: q.sourceId,
          query: q.query,
          from: q.from,
          to: q.to,
          sort: q.sort,
          cursor: q.cursor,
          limit: q.limit,
        })}`,
        signal,
      ),
    record: (id, signal) => get(`/evidence/${enc(id)}`, signal),
    preview: (sourceId, signal) => get(`/sources/${enc(sourceId)}/preview`, signal),
  };
}

export function isAbort(e: unknown): boolean {
  return e instanceof DOMException && e.name === "AbortError";
}
