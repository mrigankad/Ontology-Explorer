import { getRepository } from "@/lib/ontology/repository";
import { getViewer, notFound, ok } from "@/lib/ontology/server";

export async function GET(_req: Request, ctx: RouteContext<"/api/ontology/entities/[id]">) {
  const { id } = await ctx.params;
  const entity = getRepository().getEntity(await getViewer(), id);
  return entity ? ok(entity, entity.classification) : notFound("Entity");
}
