"use client";

import { useEffect, useState } from "react";
import type { OntologyDataAdapter } from "@/lib/ontology/client";
import type { EvidenceQuery, EvidenceRow, EvidenceSort, Page, RecordKind, Stance } from "@/lib/ontology/types";
import { Icon, Select } from "./controls";
import { useDebounced, useResource } from "./hooks";
import {
  DemoBadge,
  ErrorState,
  KIND_LABEL,
  Loading,
  STANCE_LABEL,
  StanceBadge,
  StateBadge,
  formatDate,
  formatLocator,
} from "./ui";
import type { EvidenceState } from "@/lib/ontology/types";

export interface EvidenceFilters {
  query: string;
  kind: RecordKind | null;
  stance: Stance | null;
  source: string | null;
  from: string | null;
  to: string | null;
  sort: EvidenceSort;
}

interface Props {
  adapter: OntologyDataAdapter;
  target: { kind: "rel" | "ent"; id: string };
  heading: React.ReactNode;
  claimState: EvidenceState | null;
  filters: EvidenceFilters;
  activeRecord: string | null;
  onFilters: (f: Partial<EvidenceFilters>) => void;
  onOpenRecord: (id: string) => void;
  onClose: () => void;
}

const PAGE = 8;

export function EvidenceSheet({ adapter, target, heading, claimState, filters, activeRecord, onFilters, onOpenRecord, onClose }: Props) {
  const [queryDraft, setQueryDraft] = useState(filters.query);
  const debounced = useDebounced(queryDraft, 250);
  useEffect(() => {
    if (debounced !== filters.query) onFilters({ query: debounced });
  }, [debounced, filters.query, onFilters]);

  const [cursors, setCursors] = useState<Array<string | null>>([null]);
  const [raw, setRaw] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const cursor = cursors[cursors.length - 1];

  const base: EvidenceQuery = target.kind === "rel" ? { relationshipId: target.id } : { entityId: target.id };
  const q: EvidenceQuery = {
    ...base,
    query: filters.query || undefined,
    kind: filters.kind ?? undefined,
    stance: filters.stance ?? undefined,
    sourceId: filters.source ?? undefined,
    from: filters.from ? `${filters.from}T00:00:00.000Z` : undefined,
    to: filters.to ? `${filters.to}T23:59:59.999Z` : undefined,
    sort: filters.sort,
    cursor,
    limit: PAGE,
  };
  const key = JSON.stringify(q);
  const res = useResource<Page<EvidenceRow>>(key, (s) => adapter.evidence(q, s));
  // Facets: sources available for this target, independent of other filters.
  const facets = useResource<Page<EvidenceRow>>(`facets:${JSON.stringify(base)}`, (s) => adapter.evidence({ ...base, limit: 50 }, s));
  const sources = [...new Map((facets.data?.items ?? []).map((r) => [r.source.id, r.source])).values()];

  const page = res.data;
  const start = (cursors.length - 1) * PAGE;
  const setFilter = (f: Partial<EvidenceFilters>) => {
    setCursors([null]);
    onFilters(f);
  };
  const sortBy = (col: "title" | "kind" | "stance" | "created") => {
    const next: EvidenceSort =
      col === "created" ? (filters.sort === "created_desc" ? "created_asc" : "created_desc") : (`${col}_asc` as EvidenceSort);
    setFilter({ sort: next });
  };
  const ariaSort = (col: string) => {
    if (col === "created") return filters.sort === "created_desc" ? "descending" : filters.sort === "created_asc" ? "ascending" : "none";
    return filters.sort === `${col}_asc` ? "ascending" : "none";
  };
  const activeCount = [filters.kind, filters.stance, filters.source, filters.from, filters.to].filter(Boolean).length;
  const filtersActive = !!(filters.query || filters.kind || filters.stance || filters.source || filters.from || filters.to);

  return (
    <section className="ox-sheet" aria-labelledby="ox-sheet-title">
      <header className="ox-sheet__head">
        <div className="ox-sheet__title-wrap">
          <h2 id="ox-sheet-title" className="ox-sheet__title">
            Evidence
          </h2>
          <div className="ox-sheet__target">{heading}</div>
          {claimState && <StateBadge state={claimState} />}
          <DemoBadge />
        </div>
        <button type="button" className="ox-icon-btn" onClick={onClose} aria-label="Close evidence table">
          <Icon name="close" />
        </button>
      </header>

      <div className="ox-sheet__tools" role="search">
        <label className="ox-field ox-field--grow">
          <span className="sr-only">Search evidence</span>
          <input
            type="search"
            name="evidence-search"
            autoComplete="off"
            placeholder="Search records, excerpts and sources…"
            value={queryDraft}
            onChange={(e) => {
              setQueryDraft(e.target.value);
              setCursors([null]);
            }}
          />
        </label>
        {/* In narrow sheets the filters fold away so the records stay visible. */}
        <button
          type="button"
          className="ox-btn ox-sheet__more-toggle"
          aria-expanded={moreOpen}
          aria-controls="ox-sheet-more"
          onClick={() => setMoreOpen((v) => !v)}
        >
          <Icon name="filter" size={14} />
          Filters
          {activeCount > 0 && <span className="ox-count">{activeCount}</span>}
        </button>
        <div id="ox-sheet-more" className={`ox-sheet__more${moreOpen ? " is-open" : ""}`}>
        <Select
          label="Kind"
          className="ox-field"
          size="s"
          value={filters.kind ?? ""}
          onChange={(v) => setFilter({ kind: (v as RecordKind) || null })}
          options={[{ value: "", label: "All kinds" }, ...Object.entries(KIND_LABEL).map(([value, label]) => ({ value, label }))]}
        />
        <Select
          label="Stance"
          className="ox-field"
          size="s"
          value={filters.stance ?? ""}
          onChange={(v) => setFilter({ stance: (v as Stance) || null })}
          options={[{ value: "", label: "All stances" }, ...Object.entries(STANCE_LABEL).map(([value, label]) => ({ value, label }))]}
        />
        <Select
          label="Source"
          className="ox-field"
          size="s"
          value={filters.source ?? ""}
          onChange={(v) => setFilter({ source: v || null })}
          options={[{ value: "", label: "All sources" }, ...sources.map((src) => ({ value: src.id, label: src.title }))]}
        />
        <label className="ox-field">
          <span>From</span>
          <input type="date" name="evidence-from" value={filters.from ?? ""} onChange={(e) => setFilter({ from: e.target.value || null })} />
        </label>
        <label className="ox-field">
          <span>To</span>
          <input type="date" name="evidence-to" value={filters.to ?? ""} onChange={(e) => setFilter({ to: e.target.value || null })} />
        </label>
        </div>
        <button type="button" className="ox-btn ox-btn--quiet" aria-pressed={raw} onClick={() => setRaw(!raw)}>
          {raw ? "Table" : "Raw JSON"}
        </button>
      </div>

      <div className="ox-sheet__body">
        {res.error && !page ? (
          <ErrorState title="Couldn’t load evidence" error={res.error} onRetry={res.retry} />
        ) : !page ? (
          <Loading label="Loading evidence" />
        ) : page.total === 0 ? (
          <div className="ox-empty">
            {filtersActive ? (
              <>
                <p>No evidence matches these filters.</p>
                <button
                  type="button"
                  className="ox-btn ox-btn--quiet"
                  onClick={() => {
                    setQueryDraft("");
                    setFilter({ query: "", kind: null, stance: null, source: null, from: null, to: null });
                  }}
                >
                  Clear filters
                </button>
              </>
            ) : (
              <>
                <p>
                  <strong>No evidence linked.</strong> No record you can access supports or contradicts this{" "}
                  {target.kind === "rel" ? "relationship" : "entity"}. Until a curator links a source, treat it as unverified.
                </p>
                <p className="ox-muted ox-small">Restricted records are not counted here if your role can’t open them.</p>
              </>
            )}
          </div>
        ) : raw ? (
          <pre className="ox-raw" tabIndex={0} aria-label="Raw evidence rows">
            {JSON.stringify(page.items, null, 2)}
          </pre>
        ) : (
          <div className={`ox-tablewrap${res.loading ? " is-stale" : ""}`} tabIndex={0} aria-label="Evidence rows">
            <table className="ox-table">
              <thead>
                <tr>
                  <Th label="Record" type="text" sort={ariaSort("title")} onSort={() => sortBy("title")} />
                  <Th label="Kind" type="enum" sort={ariaSort("kind")} onSort={() => sortBy("kind")} />
                  <Th label="Claim" type="triple" />
                  <Th label="Stance" type="enum" sort={ariaSort("stance")} onSort={() => sortBy("stance")} />
                  <Th label="Locator" type="locator" />
                  <Th label="Source" type="ref" />
                  <Th label="Review" type="enum" />
                  <Th label="Created" type="date" sort={ariaSort("created")} onSort={() => sortBy("created")} />
                </tr>
              </thead>
              <tbody>
                {page.items.map((r) => (
                  <tr key={r.linkId} className={r.record.id === activeRecord ? "is-active" : undefined}>
                    <td>
                      <button type="button" className="ox-rowlink" onClick={() => onOpenRecord(r.record.id)}>
                        {r.record.title}
                      </button>
                      {r.excerpt && <span className="ox-excerpt">“{r.excerpt}”</span>}
                    </td>
                    <td>{KIND_LABEL[r.record.kind]}</td>
                    <td className="ox-claimcell">
                      {r.claim.kind === "relationship" ? (
                        <>
                          {r.claim.subject.label} <span className="ox-pred">{r.claim.predicate}</span> {r.claim.object.label}
                        </>
                      ) : (
                        <>
                          {r.claim.label}
                          {r.claim.property && <span className="ox-pred"> .{r.claim.property}</span>}
                        </>
                      )}
                    </td>
                    <td>
                      <StanceBadge stance={r.stance} />
                    </td>
                    <td className="ox-mono">{formatLocator(r.record.locator)}</td>
                    <td>
                      {r.source.title}
                      {r.record.ingestStatus !== "ingested" && <span className="ox-flag"> {r.record.ingestStatus}</span>}
                    </td>
                    <td>
                      <span className={`ox-review ox-review--${r.reviewerDecision}`}>{r.reviewerDecision}</span>
                      {r.confidence != null && <span className="ox-muted ox-small"> model {Math.round(r.confidence * 100)}%</span>}
                    </td>
                    <td className="ox-nowrap">{formatDate(r.record.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {page && page.total > 0 && (
        <footer className="ox-sheet__foot">
          <span role="status">
            {start + 1}–{start + page.items.length} of {page.total} evidence {page.total === 1 ? "link" : "links"}
          </span>
          <div className="ox-btnrow">
            <button type="button" className="ox-btn ox-btn--quiet" disabled={cursors.length <= 1} onClick={() => setCursors(cursors.slice(0, -1))}>
              Previous
            </button>
            <button
              type="button"
              className="ox-btn ox-btn--quiet"
              disabled={!page.nextCursor}
              onClick={() => page.nextCursor && setCursors([...cursors, page.nextCursor])}
            >
              Next
            </button>
          </div>
        </footer>
      )}
    </section>
  );
}

function Th({ label, type, sort, onSort }: { label: string; type: string; sort?: "ascending" | "descending" | "none"; onSort?: () => void }) {
  return (
    <th scope="col" aria-sort={sort}>
      {onSort ? (
        <button type="button" className="ox-th" onClick={onSort}>
          {label}
          <span className="ox-th__type">{type}</span>
          <span aria-hidden="true" className={`ox-th__sort${sort && sort !== "none" ? " is-on" : ""}`}>
            <Icon name={sort === "ascending" ? "arrowUp" : sort === "descending" ? "arrowDown" : "sort"} size={12} />
          </span>
        </button>
      ) : (
        <span className="ox-th">
          {label}
          <span className="ox-th__type">{type}</span>
        </span>
      )}
    </th>
  );
}
