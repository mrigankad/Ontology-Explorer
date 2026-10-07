import { redirect } from "next/navigation";

/** Stable, human-shareable record URL. The explorer opens the record over the graph. */
export default async function RecordPage({ params }: PageProps<"/records/[id]">) {
  const { id } = await params;
  redirect(`/?rec=${encodeURIComponent(id)}`);
}
