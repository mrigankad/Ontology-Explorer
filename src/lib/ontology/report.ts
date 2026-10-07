import type { EvidenceRow, Locator, RelationshipDetail } from "./types";

/**
 * Plain-Markdown report of a traversal trail: each hop's claim, its status, and
 * the evidence records behind it with exact locators, so a finding can be
 * pasted into a ticket, email or doc and still be checked later.
 */

export interface TrailHop {
  from: string;
  to: string;
  /** Null when two consecutive trail entities aren't directly linked. */
  relationship: RelationshipDetail | null;
  evidence: EvidenceRow[];
}

export interface TrailReportInput {
  labels: string[];
  hops: TrailHop[];
  datasetLabel: string;
  isDemo: boolean;
  viewUrl: string;
  recordUrl: (id: string) => string;
  exportedAt: Date;
}

const pad = (n: number) => String(n).padStart(2, "0");
const ms = (v: number) => `${pad(Math.floor(v / 60000))}:${pad(Math.floor(v / 1000) % 60)}`;

export function locatorText(l: Locator): string {
  switch (l.type) {
    case "page":
      return l.lineStart === l.lineEnd ? `page ${l.page}, line ${l.lineStart}` : `page ${l.page}, lines ${l.lineStart}–${l.lineEnd}`;
    case "time":
      return `${ms(l.startMs)}–${ms(l.endMs)}${l.speaker ? ` (${l.speaker})` : ""}`;
    case "bbox":
      return `region x ${l.x}, y ${l.y}, ${l.w}×${l.h} px`;
    case "row":
      return `row ${l.key} of ${l.table}`;
    case "interval":
      return `${l.channel} from ${l.start} to ${l.end}`;
  }
}

const STANCE: Record<EvidenceRow["stance"], string> = { supports: "Supports", contradicts: "Contradicts", context: "Context" };

export function formatTrailReport(r: TrailReportInput): string {
  const out: string[] = [];
  out.push(`# Evidence trail: ${r.labels.join(" → ")}`, "");
  out.push(`Exported ${r.exportedAt.toISOString().slice(0, 16).replace("T", " ")} UTC from the Wayam Ontology Explorer.`);
  out.push(`Dataset: ${r.datasetLabel}.`);
  if (r.isDemo) {
    out.push("", "> **Demo data, not verified.** Every record below is a synthetic fixture. Nothing here is evidence of a real claim.");
  }
  out.push("", `Open this view: ${r.viewUrl}`, "");

  const verified = r.hops.filter((h) => h.relationship?.evidenceState === "verified").length;
  const unsupported = r.hops.filter((h) => !h.relationship || h.evidence.filter((e) => e.stance === "supports").length === 0).length;
  const disputed = r.hops.filter((h) => h.relationship?.evidenceState === "disputed").length;
  out.push("## Summary", "");
  out.push(`- ${r.hops.length} ${r.hops.length === 1 ? "hop" : "hops"}, ${verified} verified.`);
  if (unsupported) out.push(`- ${unsupported} ${unsupported === 1 ? "hop has" : "hops have"} no supporting evidence linked. Treat those links as unverified.`);
  if (disputed) out.push(`- ${disputed} ${disputed === 1 ? "hop is" : "hops are"} disputed by at least one record.`);
  out.push("");

  r.hops.forEach((h, i) => {
    const rel = h.relationship;
    if (!rel) {
      out.push(`## ${i + 1}. ${h.from} → ${h.to}`, "", "These two entities are not directly linked in the loaded graph.", "");
      return;
    }
    out.push(`## ${i + 1}. ${rel.subject.label} ${rel.label} ${rel.object.label}`, "");
    out.push(`- Claim status: ${rel.status}. Evidence state: ${stateText(rel.evidenceState)}.`);
    out.push(`- Provenance: ${rel.provenanceNote}`);
    out.push(`- Relationship ID: \`${rel.id}\``, "");
    if (!h.evidence.length) {
      out.push("No evidence linked. This link is an unverified assertion.", "");
      return;
    }
    for (const e of h.evidence) {
      const review = e.reviewerDecision === "accepted" ? "reviewed and accepted" : e.reviewerDecision === "rejected" ? "rejected on review" : "not yet reviewed";
      out.push(`- **${STANCE[e.stance]}**: ${e.record.title} (${locatorText(e.record.locator)}, in “${e.source.title}”), ${review}.`);
      if (e.excerpt) out.push(`  > ${e.excerpt}`);
      out.push(`  Record: ${r.recordUrl(e.record.id)}`);
    }
    out.push("");
  });
  return out.join("\n");
}

function stateText(s: RelationshipDetail["evidenceState"]): string {
  return s === "verified" ? "verified" : s === "linked" ? "evidence linked, not reviewed" : s === "disputed" ? "disputed" : "no evidence linked";
}

export function reportFilename(labels: string[]): string {
  const slug = labels
    .join("-to-")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
  return `wayam-trail-${slug || "export"}.md`;
}
