"use client";

import { useMemo, useState } from "react";
import type { OntologyDataAdapter } from "@/lib/ontology/client";
import type { EntityDetail, LinkedEntity, OntologyType, RelationType } from "@/lib/ontology/types";
import { BackButton, Icon, Select } from "./controls";
import { EntityIcon } from "./EntityIcon";
import { EvidencePreview } from "./EvidencePreview";
import { useResource } from "./hooks";
import {
  EvidenceSummary,
  ErrorState,
  IdText,
  PanelSkeleton,
  StatTile,
  StateBadge,
  Tile,
  TypeChip,
  familyVars,
  formatDate,
  totalEvidence,
} from "./ui";

export interface ExpandOptions {
  direction: "in" | "out" | "both";
  relation: string;
  depth: number;
}

export interface ExpansionInfo {
  loaded: number;
  total: number;
  hasMore: boolean;
  loading: boolean;
  error: string | null;
}

interface Props {
  adapter: OntologyDataAdapter;
  id: string;
  rootId: string;
  types: Map<string, OntologyType>;
  relationTypes: RelationType[];
  expansion: ExpansionInfo | undefined;
  isolated: boolean;
  onFocusEntity: (id: string) => void;
  onSelectEdge: (id: string) => void;
  onOpenEvidence: () => void;
  onOpenRecord: (id: string) => void;
  onExpand: (opts: ExpandOptions, more: boolean) => void;
  onCollapse: () => void;
  onToggleIsolate: () => void;
  onClose: () => void;
  /** One step back along the trail, when there is one. */
  back?: { label: string; onClick: () => void };
}

export function NodeInspector(props: Props) {
  const { adapter, id, back } = props;
  const res = useResource<EntityDetail>(`entity:${id}`, (s) => adapter.entity(id, s));

  return (
    <section className="ox-inspector" aria-labelledby="ox-inspector-title">
      <header className="ox-inspector__bar">
        {back ? <BackButton label={`Back to ${back.label}`} onClick={back.onClick} className="ox-back--quiet" /> : <span className="ox-inspector__kind">Entity</span>}
        <button type="button" className="ox-icon-btn" onClick={props.onClose} aria-label="Close inspector">
          <Icon name="close" />
        </button>
      </header>
      {res.error && !res.data ? (
        <ErrorState
          title={res.error.message.includes("not found") ? "This entity is not available" : "Couldn’t load this entity"}
          error={res.error}
          onRetry={res.retry}
        />
      ) : !res.data ? (
        <PanelSkeleton label="Loading entity" />
      ) : (
        <NodeBody {...props} detail={res.data} stale={res.loading} />
      )}
    </section>
  );
}

function NodeBody({
  detail,
  stale,
  rootId,
  types,
  relationTypes,
  expansion,
  isolated,
  onFocusEntity,
  onSelectEdge,
  onOpenEvidence,
  onOpenRecord,
  onExpand,
  onCollapse,
  onToggleIsolate,
  adapter,
}: Props & { detail: EntityDetail; stale: boolean }) {
  const [opts, setOpts] = useState<ExpandOptions>({ direction: "both", relation: "", depth: 1 });
  const groups = useMemo(() => groupLinks(detail.linked), [detail.linked]);
  const evidenceTotal = totalEvidence(detail.evidence);
  const props = Object.entries(detail.properties);
  const relevantRelations = relationTypes.filter(
    (r) => r.subjectTypes.includes(detail.typeId) || r.objectTypes.includes(detail.typeId),
  );

  const outCount = detail.linked.filter((l) => l.direction === "out").length;
  const contradicting = detail.evidence.contradicts;
  return (
    <div className={`ox-inspector__body ox-panel-bento${stale ? " is-stale" : ""}`}>
      {/* Identity */}
      <section className="ox-tile ox-tile--identity" style={familyVars(detail.family)} aria-labelledby="ox-inspector-title">
        <div className="ox-entity-id">
          <span className="ox-entity-tile" aria-hidden="true">
            <EntityIcon id={detail.id} family={detail.family} glyph={detail.type.glyph} size={32} />
          </span>
          <div className="ox-entity-id__text">
            <TypeChip type={detail.type} />
            <h2 id="ox-inspector-title" className="ox-entity-title">
              {detail.label}
            </h2>
          </div>
        </div>
        <div className="ox-entity-meta">
          <IdText>{detail.id}</IdText>
          <span className={`ox-status ox-status--${detail.status}`}>{detail.status}</span>
          <span className="ox-muted">Updated {formatDate(detail.updatedAt)}</span>
        </div>
        <p className="ox-desc">{detail.description}</p>
        {detail.aliases.length > 0 && <p className="ox-small ox-muted">Also known as {detail.aliases.join(", ")}</p>}
        {detail.provenance !== "curated" && (
          <p className="ox-note">
            {detail.provenance === "reference-graphic"
              ? "From the Wayam reference graphic. Illustrative until a curator attaches sources."
              : "A demo fixture, not a sourced fact."}
          </p>
        )}
      </section>

      {/* At a glance */}
      <div className="ox-stat-row">
        <StatTile value={detail.linked.length} label={`Links, ${outCount} out`} />
        <StatTile value={evidenceTotal} label="Evidence links" tone={evidenceTotal ? undefined : "muted"} />
        <StatTile
          value={contradicting > 0 ? contradicting : detail.evidence.verifiedSupports}
          label={contradicting > 0 ? "Contradicting" : "Verified"}
          tone={contradicting > 0 ? "danger" : "muted"}
        />
      </div>

      <Tile label="Evidence" count={evidenceTotal || undefined}>
        {evidenceTotal === 0 ? (
          <div className="ox-missing">
            <StateBadge state="none" />
            <p>Nothing links this entity to a source yet, directly or through its relationships. Treat it as unverified.</p>
          </div>
        ) : (
          <>
            <dl className="ox-dl ox-dl--grid">
              <dt>Via relationships</dt>
              <dd>
                <EvidenceSummary
                  counts={{
                    supports: detail.evidence.supports - detail.directEvidence.supports,
                    contradicts: detail.evidence.contradicts - detail.directEvidence.contradicts,
                    context: detail.evidence.context - detail.directEvidence.context,
                    verifiedSupports: 0,
                  }}
                />
              </dd>
              <dt>About it directly</dt>
              <dd>
                <EvidenceSummary counts={detail.directEvidence} />
              </dd>
            </dl>
            <EvidencePreview
              adapter={adapter}
              query={{ entityId: detail.id }}
              total={evidenceTotal}
              onOpenRecord={onOpenRecord}
              onViewAll={onOpenEvidence}
            />
          </>
        )}
      </Tile>

      <Tile label="Links" count={detail.linked.length}>
        {groups.length === 0 && <p className="ox-muted">No visible relationships.</p>}
        {groups.map((g) => (
          <div key={g.key} className="ox-linkgroup">
            <h4 className="ox-linkgroup__head">
              <span className="ox-dir" role="img" aria-label={g.direction === "out" ? "Outbound" : "Inbound"}>
                <Icon name={g.direction === "out" ? "arrowRight" : "arrowLeft"} size={13} />
              </span>
              {g.direction === "out"
                ? g.label
                : (relationTypes.find((r) => r.id === g.relationTypeId)?.inverseLabel ?? `${g.label} (inbound)`)}
            </h4>
            <ul className="ox-linklist">
              {g.items.map((l) => (
                <li key={l.edge.id} className="ox-linkrow">
                  <button
                    type="button"
                    className="ox-linkrow__entity"
                    style={familyVars(l.entity.family)}
                    onClick={() => onFocusEntity(l.entity.id)}
                  >
                    <EntityIcon
                      id={l.entity.id}
                      family={l.entity.family}
                      glyph={types.get(l.entity.typeId)?.glyph ?? ""}
                      size={16}
                      className="ox-linkrow__glyph"
                    />
                    {l.entity.label}
                    {l.entity.id === rootId && <span className="sr-only"> (root)</span>}
                  </button>
                  <button
                    type="button"
                    className="ox-linkrow__claim"
                    onClick={() => onSelectEdge(l.edge.id)}
                    aria-label={`Inspect relationship ${l.edge.label} ${l.entity.label}`}
                  >
                    <StateBadge state={l.edge.evidenceState} compact />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </Tile>

      <Tile label="Explore from here">
        <div className="ox-expand">
          <Select
            label="Direction"
            className="ox-field"
            size="s"
            value={opts.direction}
            onChange={(v) => setOpts({ ...opts, direction: v })}
            options={[
              { value: "both", label: "Both ways" },
              { value: "out", label: "Outbound" },
              { value: "in", label: "Inbound" },
            ]}
          />
          <Select
            label="Relation"
            className="ox-field"
            size="s"
            value={opts.relation}
            onChange={(v) => setOpts({ ...opts, relation: v })}
            options={[{ value: "", label: "Any" }, ...relevantRelations.map((r) => ({ value: r.id, label: r.label }))]}
          />
          <Select
            label="Depth"
            className="ox-field ox-field--narrow"
            size="s"
            value={String(opts.depth) as "1" | "2" | "3"}
            onChange={(v) => setOpts({ ...opts, depth: Number(v) })}
            options={[
              { value: "1", label: "1" },
              { value: "2", label: "2" },
              { value: "3", label: "3" },
            ]}
          />
        </div>
        <div className="ox-btnrow">
          <button type="button" className="ox-btn ox-btn--primary" onClick={() => onExpand(opts, false)} disabled={expansion?.loading}>
            {expansion?.loading ? "Expanding…" : "Expand neighbours"}
          </button>
          {expansion?.hasMore && (
            <button type="button" className="ox-btn" onClick={() => onExpand(opts, true)} disabled={expansion.loading}>
              Load more ({expansion.loaded} of {expansion.total})
            </button>
          )}
          {expansion && (
            <button type="button" className="ox-btn ox-btn--quiet" onClick={onCollapse}>
              Collapse branch
            </button>
          )}
          <button type="button" className="ox-btn ox-btn--quiet" aria-pressed={isolated} onClick={onToggleIsolate}>
            {isolated ? "Show everything" : "Isolate"}
          </button>
        </div>
        {expansion && !expansion.loading && !expansion.error && (
          <p className="ox-muted ox-small" role="status">
            Loaded {expansion.loaded} of {expansion.total} matching links.
          </p>
        )}
        {expansion?.error && (
          <p className="ox-inline-error" role="alert">
            {expansion.error}
          </p>
        )}
      </Tile>

      <Tile label="Details">
        <dl className="ox-dl ox-dl--grid">
          {props.map(([k, v]) => (
            <div key={k} className="ox-dl__row">
              <dt>{k}</dt>
              <dd>{v === null ? <span className="ox-muted">Not recorded</span> : String(v)}</dd>
            </div>
          ))}
          <dt>Class</dt>
          <dd>{detail.type.label}</dd>
          <dt>Access</dt>
          <dd>{detail.classification}</dd>
          <dt>Created</dt>
          <dd>{formatDate(detail.createdAt)}</dd>
        </dl>
      </Tile>
    </div>
  );
}

function groupLinks(linked: LinkedEntity[]) {
  const map = new Map<string, { key: string; direction: "in" | "out"; relationTypeId: string; label: string; items: LinkedEntity[] }>();
  for (const l of linked) {
    const key = `${l.direction}:${l.edge.relationTypeId}`;
    if (!map.has(key)) map.set(key, { key, direction: l.direction, relationTypeId: l.edge.relationTypeId, label: l.edge.label, items: [] });
    map.get(key)!.items.push(l);
  }
  return [...map.values()].sort((a, b) => (a.direction === b.direction ? a.label.localeCompare(b.label) : a.direction === "out" ? -1 : 1));
}
