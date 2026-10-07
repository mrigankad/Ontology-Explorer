import type { NextRequest } from "next/server";
import { getRepository } from "@/lib/ontology/repository";
import { badRequest, getViewer, intParam, ok } from "@/lib/ontology/server";

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const limit = intParam(p.get("limit"), 20, 1, 50);
  if (limit == null) return badRequest("limit must be an integer between 1 and 50");
  const viewer = await getViewer();
  return ok(
    getRepository().searchEntities(viewer, {
      query: p.get("query") ?? undefined,
      type: p.get("type") ?? undefined,
      cursor: p.get("cursor"),
      limit,
    }),
  );
}
