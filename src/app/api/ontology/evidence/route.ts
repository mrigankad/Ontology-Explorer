import type { NextRequest } from "next/server";
import { getRepository } from "@/lib/ontology/repository";
import { badRequest, getViewer, intParam, ok } from "@/lib/ontology/server";
import type { EvidenceSort, RecordKind, Stance } from "@/lib/ontology/types";

const SORTS: EvidenceSort[] = ["created_desc", "created_asc", "title_asc", "kind_asc", "stance_asc"];

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const limit = intParam(p.get("limit"), 10, 1, 50);
  if (limit == null) return badRequest("limit must be between 1 and 50");
  const sort = (p.get("sort") ?? "created_desc") as EvidenceSort;
  if (!SORTS.includes(sort)) return badRequest(`sort must be one of ${SORTS.join(", ")}`);
  const viewer = await getViewer();
  return ok(
    getRepository().listEvidence(viewer, {
      entityId: p.get("entityId") ?? undefined,
      relationshipId: p.get("relationshipId") ?? undefined,
      kind: (p.get("kind") as RecordKind) || undefined,
      stance: (p.get("stance") as Stance) || undefined,
      sourceId: p.get("sourceId") ?? undefined,
      query: p.get("query") ?? undefined,
      from: p.get("from") ?? undefined,
      to: p.get("to") ?? undefined,
      sort,
      cursor: p.get("cursor"),
      limit,
    }),
  );
}
