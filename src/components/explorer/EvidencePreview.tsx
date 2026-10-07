"use client";

import type { OntologyDataAdapter } from "@/lib/ontology/client";
import type { EvidenceQuery, EvidenceRow, Page } from "@/lib/ontology/types";
import { RecordIcon } from "./EntityIcon";
import { useResource } from "./hooks";
import { KIND_LABEL, StanceBadge, formatLocator } from "./ui";

interface Props {
  adapter: OntologyDataAdapter;
  query: Pick<EvidenceQuery, "entityId" | "relationshipId">;
  total: number;
  onOpenRecord: (id: string) => void;
  onViewAll: () => void;
}

const SHOWN = 3;

/**
 * The first few evidence records, inline in the inspector, so checking a claim
 * doesn't require opening the full table. Contradicting records sort first
 * because they change how the claim should be read.
 */
export function EvidencePreview({ adapter, query, total, onOpenRecord, onViewAll }: Props) {
  const key = JSON.stringify(query);
  const res = useResource<Page<EvidenceRow>>(`preview-ev:${key}`, (s) => adapter.evidence({ ...query, limit: 10, sort: "stance_asc" }, s));
  if (res.error && !res.data) return <p className="ox-inline-error">Couldn’t load evidence. {res.error.message}</p>;
  if (!res.data) {
    return (
      <ul className="ox-evlist" aria-busy="true" aria-label="Loading evidence">
        {Array.from({ length: Math.min(total, SHOWN) || 1 }, (_, i) => (
          <li key={i} className="ox-evcard ox-evcard--skeleton" />
        ))}
      </ul>
    );
  }
  const order = { contradicts: 0, supports: 1, context: 2 } as const;
  const rows = [...res.data.items].sort((a, b) => order[a.stance] - order[b.stance]).slice(0, SHOWN);
  return (
    <>
      <ul className="ox-evlist">
        {rows.map((r) => (
          <li key={r.linkId}>
            <button type="button" className={`ox-evcard ox-evcard--${r.stance}`} onClick={() => onOpenRecord(r.record.id)}>
              <span className="ox-evcard__top">
                <StanceBadge stance={r.stance} />
                <RecordIcon kind={r.record.kind} size={16} />
                <span className="ox-evcard__kind">{KIND_LABEL[r.record.kind]}</span>
                {r.record.isDemo && <span className="ox-evcard__demo">Demo</span>}
              </span>
              <span className="ox-evcard__title">{r.record.title}</span>
              {r.excerpt && <span className="ox-evcard__excerpt">“{r.excerpt}”</span>}
              <span className="ox-evcard__loc">
                {formatLocator(r.record.locator)} in {r.source.title}
              </span>
            </button>
          </li>
        ))}
      </ul>
      <button type="button" className="ox-btn ox-btn--primary" onClick={onViewAll}>
        {total > SHOWN ? `View all ${total} in the evidence table` : "Open in the evidence table"}
      </button>
    </>
  );
}
