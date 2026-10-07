import { getRepository } from "@/lib/ontology/repository";
import { getViewer, notFound, ok } from "@/lib/ontology/server";

/**
 * Sanitised preview payload. With real object storage this route would check
 * access, then return a short-lived signed URL or stream — never a raw bucket path.
 */
export async function GET(_req: Request, ctx: RouteContext<"/api/ontology/sources/[id]/preview">) {
  const { id } = await ctx.params;
  const preview = getRepository().sourcePreview(await getViewer(), id);
  return preview ? ok(preview) : notFound("Source");
}
