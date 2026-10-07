import { getRepository } from "@/lib/ontology/repository";
import { getViewer, notFound, ok } from "@/lib/ontology/server";

export async function GET(_req: Request, ctx: RouteContext<"/api/ontology/relationships/[id]">) {
  const { id } = await ctx.params;
  const rel = getRepository().getRelationship(await getViewer(), id);
  return rel ? ok(rel) : notFound("Relationship");
}
