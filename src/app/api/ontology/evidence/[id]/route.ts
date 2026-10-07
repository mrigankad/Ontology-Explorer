import { getRepository } from "@/lib/ontology/repository";
import { getViewer, notFound, ok } from "@/lib/ontology/server";

export async function GET(_req: Request, ctx: RouteContext<"/api/ontology/evidence/[id]">) {
  const { id } = await ctx.params;
  const detail = getRepository().getEvidenceRecord(await getViewer(), id);
  return detail ? ok(detail, detail.record.classification) : notFound("Evidence record");
}
