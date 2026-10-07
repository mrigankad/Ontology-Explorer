"use client";

import { useEffect, useRef } from "react";
import type { OntologyDataAdapter } from "@/lib/ontology/client";
import type { ClaimSummary, EvidenceRecordDetail, SourcePreview as Preview } from "@/lib/ontology/types";
import { BackButton, Icon } from "./controls";
import { useResource } from "./hooks";
import { SourcePreview } from "./SourcePreview";
import {
  DemoBadge,
  ErrorState,
  IdText,
  KIND_LABEL,
  Loading,
  StanceBadge,
  Tile,
  formatDateTime,
  formatLocator,
} from "./ui";

export interface RecordNav {
  index: number;
  total: number;
  prev: string | null;
  next: string | null;
}

interface Props {
  adapter: OntologyDataAdapter;
  id: string;
  /** Position within the open evidence table, for stepping through records. */
  nav: RecordNav | null;
  onClose: () => void;
  onShowClaim: (claim: ClaimSummary) => void;
  onOpenRecord: (id: string) => void;
}

export function RecordViewer({ adapter, id, nav, onClose, onShowClaim, onOpenRecord }: Props) {
  const res = useResource<EvidenceRecordDetail>(`record:${id}`, (s) => adapter.record(id, s));
  const sourceId = res.data?.record.id === id ? res.data.source.id : null;
  const preview = useResource<Preview>(sourceId ? `preview:${sourceId}` : null, (s) => adapter.preview(sourceId!, s));
  const headingRef = useRef<HTMLHeadingElement>(null);
  const d = res.data?.record.id === id ? res.data : undefined;

  useEffect(() => {
    headingRef.current?.focus();
  }, [d?.record.id]);

  // Left/right arrows (or J/K) step through the evidence table.
  useEffect(() => {
    if (!nav) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest("input, textarea, select")) return;
      if ((e.key === "ArrowRight" || e.key === "j") && nav.next) onOpenRecord(nav.next);
      else if ((e.key === "ArrowLeft" || e.key === "k") && nav.prev) onOpenRecord(nav.prev);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [nav, onOpenRecord]);

  return (
    <div className="ox-record-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="ox-record" role="dialog" aria-modal="true" aria-labelledby="ox-record-title">
        <header className="ox-record__bar">
          <BackButton label="Back to graph" hint="Esc" onClick={onClose} />
          {d?.record.isDemo && <DemoBadge>Demo record, not verified evidence</DemoBadge>}
          {nav && nav.total > 1 && (
            <div className="ox-recnav" role="group" aria-label="Step through evidence">
              <button
                type="button"
                className="ox-recnav__btn"
                disabled={!nav.prev}
                onClick={() => nav.prev && onOpenRecord(nav.prev)}
                aria-label="Previous record"
                title="Previous record (←)"
              >
                <Icon name="chevronLeft" size={16} />
              </button>
              <span className="ox-recnav__pos">
                Record {nav.index + 1} of {nav.total}
              </span>
              <button
                type="button"
                className="ox-recnav__btn"
                disabled={!nav.next}
                onClick={() => nav.next && onOpenRecord(nav.next)}
                aria-label="Next record"
                title="Next record (→)"
              >
                <Icon name="chevronRight" size={16} />
              </button>
            </div>
          )}
        </header>

        {res.error && !d ? (
          <div className="ox-record__error">
            <ErrorState
              title={res.error.message.includes("not found") ? "Record not found or not available to you" : "Couldn’t load this record"}
              error={res.error}
              onRetry={res.error.message.includes("not found") ? undefined : res.retry}
            />
          </div>
        ) : !d ? (
          <Loading label="Loading record" />
        ) : (
          <div className="ox-bento ox-record__bento" key={d.record.id}>
            {/* Hero: the source itself, with the citation highlighted. */}
            <Tile label={d.source.title} className="ox-tile--hero">
              <SourcePreview
                source={d.source}
                preview={preview.data ?? null}
                previewError={preview.error ?? null}
                record={d.record}
                siblings={d.siblings}
                onOpenRecord={onOpenRecord}
              />
            </Tile>

            <section className="ox-tile ox-tile--title" aria-labelledby="ox-record-title">
              <p className="ox-tile__eyebrow">{KIND_LABEL[d.record.kind]}</p>
              <h2 id="ox-record-title" className="ox-record__title" tabIndex={-1} ref={headingRef}>
                {d.record.title}
              </h2>
              <p className="ox-locator">
                <span className="ox-locator__label">Cited at</span> <span className="ox-mono">{formatLocator(d.record.locator)}</span>
              </p>
              {d.record.content ? (
                <blockquote className="ox-quote">{d.record.content}</blockquote>
              ) : (
                <p className="ox-muted">Extraction is {d.record.ingestStatus}. No content yet.</p>
              )}
            </section>

            <Tile label="Graph claims" count={d.links.length} className="ox-tile--claims">
              {d.links.length === 0 && <p className="ox-muted">This record isn’t linked to any claim you can see.</p>}
              <ul className="ox-claims">
                {d.links.map((l) => (
                  <li key={l.linkId} className={`ox-claim ox-claim--${l.stance}`}>
                    <div className="ox-claim__top">
                      <StanceBadge stance={l.stance} />
                      <span className={`ox-review ox-review--${l.reviewerDecision}`}>Review {l.reviewerDecision}</span>
                      <button
                        type="button"
                        className="ox-claim__go"
                        onClick={() => onShowClaim(l.claim)}
                        aria-label="Show this claim in the graph"
                        title="Show in graph"
                      >
                        <Icon name="graph" size={15} />
                        <span>Show in graph</span>
                      </button>
                    </div>
                    <p className="ox-claim__triple">
                      {l.claim.kind === "relationship" ? (
                        <>
                          <span>{l.claim.subject.label}</span>
                          <span className="ox-claim__pred">
                            <Icon name="arrowRight" size={13} />
                            {l.claim.predicate}
                          </span>
                          <span>{l.claim.object.label}</span>
                        </>
                      ) : (
                        <>
                          {l.claim.label}
                          {l.claim.property && <span className="ox-pred"> .{l.claim.property}</span>}
                        </>
                      )}
                    </p>
                    {l.excerpt && <p className="ox-excerpt">“{l.excerpt}”</p>}
                    {l.annotation && <p className="ox-small">{l.annotation}</p>}
                    {l.confidence != null && (
                      <p className="ox-small ox-muted">
                        Model confidence {Math.round(l.confidence * 100)}%. An extraction score, not verification.
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </Tile>

            <Tile label="Source" className="ox-tile--third">
              <dl className="ox-dl ox-dl--grid">
                <dt>Source ID</dt>
                <dd>
                  <IdText>{d.source.id}</IdText>
                </dd>
                <dt>Location</dt>
                <dd className="ox-mono ox-break">{d.source.uri}</dd>
                <dt>Type</dt>
                <dd>{d.source.mimeType}</dd>
                <dt>Checksum</dt>
                <dd className="ox-mono ox-break">{d.source.checksum}</dd>
                <dt>Owner</dt>
                <dd>{d.source.owner}</dd>
                <dt>Acquired</dt>
                <dd>{formatDateTime(d.source.acquiredAt)}</dd>
                <dt>Access</dt>
                <dd>{d.source.classification}</dd>
              </dl>
            </Tile>

            <Tile label="Extraction" className="ox-tile--third">
              <div className="ox-stats">
                <div className="ox-stats__item">
                  <span className="ox-stats__v">{d.record.ingestStatus}</span>
                  <span className="ox-stats__l">Status</span>
                </div>
                <div className="ox-stats__item">
                  <span className="ox-stats__v">{/^\d/.test(d.record.extraction.version) ? `v${d.record.extraction.version}` : d.record.extraction.version}</span>
                  <span className="ox-stats__l">{d.record.extraction.method}</span>
                </div>
              </div>
              <dl className="ox-dl ox-dl--grid">
                <dt>Record ID</dt>
                <dd>
                  <IdText>{d.record.id}</IdText>
                </dd>
                <dt>Access</dt>
                <dd>{d.record.classification}</dd>
              </dl>
              {Object.keys(d.record.payload).length > 0 && (
                <details className="ox-details">
                  <summary>Structured payload</summary>
                  <pre className="ox-raw">{JSON.stringify(d.record.payload, null, 2)}</pre>
                </details>
              )}
            </Tile>

            <Tile label="History" className="ox-tile--third">
              <ol className="ox-timeline-list">
                {d.record.ingestionHistory.map((h, i) => (
                  <li key={`h${i}`}>
                    <span className="ox-small ox-muted">{formatDateTime(h.at)}</span>
                    <p>
                      <strong>{h.event}</strong> {h.detail}
                    </p>
                  </li>
                ))}
                {d.record.annotations.map((a, i) => (
                  <li key={`a${i}`} className="is-note">
                    <span className="ox-small ox-muted">
                      Note by {a.author}, {formatDateTime(a.at)}
                    </span>
                    <p>{a.text}</p>
                  </li>
                ))}
              </ol>
            </Tile>

            {d.siblings.length > 0 && (
              <Tile label="More from this source" count={d.siblings.length} className="ox-tile--wide">
                <ul className="ox-siblings">
                  {d.siblings.map((s) => (
                    <li key={s.id}>
                      <button type="button" className="ox-sibling" onClick={() => onOpenRecord(s.id)}>
                        <span className="ox-sibling__title">{s.title}</span>
                        <span className="ox-mono ox-small">{formatLocator(s.locator)}</span>
                        <Icon name="arrowRight" size={14} />
                      </button>
                    </li>
                  ))}
                </ul>
              </Tile>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
