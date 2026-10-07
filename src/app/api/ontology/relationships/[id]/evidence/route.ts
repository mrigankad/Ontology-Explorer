import type { NextRequest } from "next/server";
import { getRepository } from "@/lib/ontology/repository";
import { badRequest, getViewer, intParam, notFound, ok } from "@/lib/ontology/server";
import type { Stance } from "@/lib/ontology/types";

export async function GET(req: NextRequest, ctx: RouteContext<"/api/ontology/relationships/[id]/evidence">) {
  const { id } = await ctx.params;
  const p = req.nextUrl.searchParams;
  const limit = intParam(p.get("limit"), 10, 1, 50);
  if (limit == null) return badRequest("limit must be between 1 and 50");
  const viewer = await getViewer();
  const repo = getRepository();
  if (!repo.getRelationship(viewer, id)) return notFound("Relationship");
  return ok(
    repo.listEvidence(viewer, {
      relationshipId: id,
      stance: (p.get("stance") as Stance) || undefined,
      cursor: p.get("cursor"),
      limit,
    }),
  );
}
