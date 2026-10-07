import type { NextRequest } from "next/server";
import { getRepository, MAX_DEPTH, MAX_LIMIT } from "@/lib/ontology/repository";
import { badRequest, getViewer, intParam, notFound, ok } from "@/lib/ontology/server";

export async function GET(req: NextRequest, ctx: RouteContext<"/api/ontology/entities/[id]/neighbors">) {
  const { id } = await ctx.params;
  const p = req.nextUrl.searchParams;
  const direction = p.get("direction") ?? "both";
  if (!["in", "out", "both"].includes(direction)) return badRequest("direction must be in, out or both");
  const depth = intParam(p.get("depth"), 1, 1, MAX_DEPTH);
  if (depth == null) return badRequest(`depth must be between 1 and ${MAX_DEPTH}`);
  const limit = intParam(p.get("limit"), 24, 1, MAX_LIMIT);
  if (limit == null) return badRequest(`limit must be between 1 and ${MAX_LIMIT}`);
  const relations = p.get("relation")?.split(",").filter(Boolean);
  const res = getRepository().neighbors(await getViewer(), id, {
    direction: direction as "in" | "out" | "both",
    relations,
    depth,
    limit,
    cursor: p.get("cursor"),
  });
  return res ? ok(res) : notFound("Entity");
}
