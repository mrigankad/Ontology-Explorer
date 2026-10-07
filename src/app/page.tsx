import { readdirSync } from "node:fs";
import { join } from "node:path";
import { cookies } from "next/headers";
import { OntologyExplorer } from "@/components/explorer/OntologyExplorer";
import { ROLE_COOKIE, resolveViewer } from "@/lib/ontology/access";
import { getRepository } from "@/lib/ontology/repository";

/**
 * Dynamic (reads the viewer cookie), so the explorer — including its
 * useSearchParams state — renders in the initial HTML with no streamed fallback.
 */
export default async function Home() {
  const viewer = resolveViewer((await cookies()).get(ROLE_COOKIE)?.value);
  // The bounded overview is rendered on the server; neighbourhoods load on demand.
  const overview = getRepository().overview(viewer);
  return <OntologyExplorer initial={overview} viewerRole={viewer.role} iconKeys={listIcons()} />;
}

/** Keys of generated icons in public/icons (see docs/icon-prompts.md). */
function listIcons(): string[] {
  try {
    return readdirSync(join(process.cwd(), "public", "icons"))
      .filter((f) => f.endsWith(".png"))
      .map((f) => f.slice(0, -4));
  } catch {
    return [];
  }
}
