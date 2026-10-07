import { getRepository } from "@/lib/ontology/repository";
import { getViewer, ok } from "@/lib/ontology/server";

export async function GET() {
  const viewer = await getViewer();
  return ok(getRepository().overview(viewer));
}
