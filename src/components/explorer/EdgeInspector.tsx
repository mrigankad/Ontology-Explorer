"use client";

import type { OntologyDataAdapter } from "@/lib/ontology/client";
import type { EntitySummary, OntologyType, RelationshipDetail } from "@/lib/ontology/types";
import { BackButton, Icon } from "./controls";
import { EvidencePreview } from "./EvidencePreview";
import { useResource } from "./hooks";
import {
  ErrorState,
  IdText,
  PanelSkeleton,
  STATE_META,
  STATUS_LABEL,
  StatTile,
  StateBadge,
  Tile,
  familyVars,
  formatDate,
  totalEvidence,
} from "./ui";

interface Props {
  adapter: OntologyDataAdapter;
  id: string;
  types: Map<string, OntologyType>;
  onFocusEntity: (id: string) => void;
  onSelectEdge: (id: string) => void;
  onOpenEvidence: () => void;
  onOpenRecord: (id: string) => void;
  onClose: () => void;
  /** One step back along the trail, when there is one. */
  back?: { label: string; onClick: () => void };
}

export function EdgeInspector({ adapter, id, types, onFocusEntity, onSelectEdge, onOpenEvidence, onOpenRecord, onClose, back }: Props) {
  const res = useResource<RelationshipDetail>(`rel:${id}`, (s) => adapter.relationship(id, s));
  const d = res.data;
  return (
    <section className="ox-inspector" aria-labelledby="ox-inspector-title">
      <header className="ox-inspector__bar">
        {back ? <BackButton label={`Back to ${back.label}`} onClick={back.onClick} className="ox-back--quiet" /> : <span className="ox-inspector__kind">Relationship</span>}
        <button type="button" className="ox-icon-btn" onClick={onClose} aria-label="Close inspector">
          <Icon name="close" />
        </button>
      </header>
      {res.error && !d ? (
        <ErrorState title="Couldn’t load this relationship" error={res.error} onRetry={res.retry} />
      ) : !d ? (
        <PanelSkeleton label="Loading relationship" />
      ) : (
        <div className={`ox-inspector__body ox-panel-bento${res.loading ? " is-stale" : ""}`}>
          <section className="ox-tile ox-tile--identity" aria-labelledby="ox-inspector-title">
          <h2 id="ox-inspector-title" className="sr-only">
            {d.subject.label} {d.label} {d.object.label}
          </h2>
          <div className="ox-triple">
            <TripleEnd entity={d.subject} types={types} onFocus={onFocusEntity} />
            <div className={`ox-triple__pred ox-triple__pred--${d.evidenceState}`}>
              <span className="ox-triple__line" />
              <span className="ox-triple__label">
                <span className="sr-only">predicate: </span>
                {d.label}
              </span>
            </div>
            <TripleEnd entity={d.object} types={types} onFocus={onFocusEntity} />
          </div>

          <p className="ox-desc">{d.meaning}</p>

          <div className="ox-statusrow">
            <StateBadge state={d.evidenceState} />
            <span className={`ox-status ox-status--${d.status}`}>{STATUS_LABEL[d.status]} claim</span>
          </div>
          </section>

          <div className="ox-stat-row">
            <StatTile value={d.evidence.supports} label="Supporting" tone={d.evidence.supports ? undefined : "muted"} />
            <StatTile value={d.evidence.contradicts} label="Contradicting" tone={d.evidence.contradicts ? "danger" : "muted"} />
            <StatTile value={d.evidence.verifiedSupports} label="Verified" tone="muted" />
          </div>

          <Tile label="Evidence" count={totalEvidence(d.evidence) || undefined}>
            {totalEvidence(d.evidence) === 0 ? (
              <div className="ox-missing">
                <p>
                  <strong>No evidence linked.</strong> This relationship is an unverified assertion. It appears here because{" "}
                  {d.provenance === "reference-graphic" ? "the reference graphic draws it" : "it was added as a demo fixture"}, not
                  because a source proves it.
                </p>
              </div>
            ) : (
              <>
                {d.evidence.context > 0 && (
                  <p className="ox-small ox-muted">
                    Plus {d.evidence.context} context {d.evidence.context === 1 ? "record" : "records"}.
                  </p>
                )}
                {d.evidence.verifiedSupports === 0 && <p className="ox-note">{STATE_META[d.evidenceState].hint}</p>}
              </>
            )}
            {totalEvidence(d.evidence) === 0 ? (
              <button type="button" className="ox-btn" onClick={onOpenEvidence}>
                Open the evidence table
              </button>
            ) : (
              <EvidencePreview
                adapter={adapter}
                query={{ relationshipId: d.id }}
                total={totalEvidence(d.evidence)}
                onOpenRecord={onOpenRecord}
                onViewAll={onOpenEvidence}
              />
            )}
          </Tile>

          <Tile label="Provenance">
            <p className="ox-small">{d.provenanceNote}</p>
            <dl className="ox-dl ox-dl--grid">
              <dt>Relationship ID</dt>
              <dd>
                <IdText>{d.id}</IdText>
              </dd>
              <dt>Predicate</dt>
              <dd>
                <IdText>{d.relationType.id}</IdText>
              </dd>
              <dt>Created by</dt>
              <dd>{d.createdBy}</dd>
              <dt>Reviewed by</dt>
              <dd>{d.reviewedBy ?? <span className="ox-muted">Not reviewed</span>}</dd>
              <dt>Valid</dt>
              <dd>{d.validFrom || d.validTo ? `${formatDate(d.validFrom)} to ${formatDate(d.validTo)}` : <span className="ox-muted">No interval recorded</span>}</dd>
              <dt>Updated</dt>
              <dd>{formatDate(d.updatedAt)}</dd>
            </dl>
          </Tile>

          {d.siblings.length > 0 && (
            <Tile label="Other claims about this pair" count={d.siblings.length}>
              <ul className="ox-linklist">
                {d.siblings.map((s) => (
                  <li key={s.id} className="ox-linkrow">
                    <button type="button" className="ox-linkrow__entity" onClick={() => onSelectEdge(s.id)}>
                      {s.label}
                    </button>
                    <StateBadge state={s.evidenceState} compact />
                  </li>
                ))}
              </ul>
            </Tile>
          )}
        </div>
      )}
    </section>
  );
}

function TripleEnd({ entity, types, onFocus }: { entity: EntitySummary; types: Map<string, OntologyType>; onFocus: (id: string) => void }) {
  const t = types.get(entity.typeId);
  return (
    <button type="button" className="ox-triple__end" style={familyVars(entity.family)} onClick={() => onFocus(entity.id)}>
      <span className="ox-triple__type">
        <span aria-hidden="true">{t?.glyph}</span> {t?.label}
      </span>
      <span className="ox-triple__name">{entity.label}</span>
    </button>
  );
}
