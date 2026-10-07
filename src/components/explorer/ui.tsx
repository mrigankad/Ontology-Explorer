"use client";

import type { ReactNode } from "react";
import type {
  AssertionStatus,
  EvidenceCounts,
  EvidenceState,
  FamilyId,
  Locator,
  OntologyType,
  RecordKind,
  Stance,
} from "@/lib/ontology/types";

export const STATE_META: Record<EvidenceState, { glyph: string; label: string; hint: string }> = {
  verified: { glyph: "✓", label: "Verified", hint: "Reviewed, non-demo evidence supports this claim." },
  linked: { glyph: "●", label: "Evidence linked", hint: "Evidence is linked but not reviewed. Not verified." },
  none: { glyph: "○", label: "No evidence linked", hint: "Nothing supports this claim yet. Treat it as unverified." },
  disputed: { glyph: "✕", label: "Disputed", hint: "At least one record contradicts this claim." },
};

export const STANCE_LABEL: Record<Stance, string> = {
  supports: "Supports",
  contradicts: "Contradicts",
  context: "Context",
};

export const KIND_LABEL: Record<RecordKind, string> = {
  document_passage: "Document passage",
  transcript_segment: "Transcript segment",
  image_region: "Image region",
  table_row: "Table row",
  sensor_interval: "Sensor interval",
};

export const STATUS_LABEL: Record<AssertionStatus, string> = {
  draft: "Draft",
  verified: "Verified",
  disputed: "Disputed",
  deprecated: "Deprecated",
};

export function familyVars(family: FamilyId): React.CSSProperties {
  return {
    ["--fam" as string]: `var(--fam-${family})`,
    ["--fam-tint" as string]: `var(--fam-${family}-tint)`,
    ["--fam-ink" as string]: `var(--fam-${family}-ink)`,
  };
}

export function TypeChip({ type }: { type: OntologyType | undefined }) {
  if (!type) return null;
  return (
    <span className="ox-type" style={familyVars(type.family)}>
      <span aria-hidden="true">{type.glyph}</span> {type.label}
    </span>
  );
}

export function StateBadge({ state, compact = false }: { state: EvidenceState; compact?: boolean }) {
  const m = STATE_META[state];
  return (
    <span className={`ox-state ox-state--${state}`} title={m.hint}>
      <span aria-hidden="true">{m.glyph}</span>
      {compact ? <span className="sr-only">{m.label}</span> : ` ${m.label}`}
    </span>
  );
}

export function StanceBadge({ stance }: { stance: Stance }) {
  return <span className={`ox-stance ox-stance--${stance}`}>{STANCE_LABEL[stance]}</span>;
}

export function DemoBadge({ size = "s", children }: { size?: "s" | "l"; children?: ReactNode }) {
  return (
    <span className={`ox-demo ox-demo--${size}`} title="Synthetic demo fixture. Not verified evidence.">
      {children ?? "Demo, not verified"}
    </span>
  );
}

export function totalEvidence(c: EvidenceCounts): number {
  return c.supports + c.contradicts + c.context;
}

export function EvidenceSummary({ counts }: { counts: EvidenceCounts }) {
  const total = totalEvidence(counts);
  if (!total) return <span className="ox-muted">No evidence linked</span>;
  const parts = [
    counts.supports && `${counts.supports} supporting`,
    counts.contradicts && `${counts.contradicts} contradicting`,
    counts.context && `${counts.context} context`,
  ].filter(Boolean);
  return <span>{parts.join(", ")}</span>;
}

const pad = (n: number) => String(n).padStart(2, "0");
export function formatMs(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${pad(Math.floor(s / 60))}:${pad(s % 60)}`;
}

export function formatLocator(l: Locator): string {
  switch (l.type) {
    case "page":
      return l.lineStart === l.lineEnd ? `p. ${l.page}, line ${l.lineStart}` : `p. ${l.page}, lines ${l.lineStart}–${l.lineEnd}`;
    case "time":
      return `${formatMs(l.startMs)}–${formatMs(l.endMs)}${l.speaker ? ` (${l.speaker})` : ""}`;
    case "bbox":
      return `x ${l.x}, y ${l.y}, ${l.w}×${l.h} px`;
    case "row":
      return `${l.table} [${l.key}]`;
    case "interval":
      return `${l.channel} ${formatTime(l.start)}–${formatTime(l.end)}`;
  }
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${formatDate(iso)}, ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

export function ErrorState({ title, error, onRetry }: { title: string; error: Error; onRetry?: () => void }) {
  return (
    <div className="ox-error" role="alert">
      <p className="ox-error__title">{title}</p>
      <p className="ox-error__msg">{error.message}</p>
      {onRetry && (
        <button type="button" className="ox-btn ox-btn--quiet" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}

export function Loading({ label }: { label: string }) {
  return (
    <div className="ox-loading" role="status" aria-live="polite">
      <span className="ox-loading__bar" aria-hidden="true" />
      {label}…
    </div>
  );
}

export function IdText({ children }: { children: string }) {
  return <code className="ox-id">{children}</code>;
}

/** One bento cell: a rounded card with a quiet label and its own scroll. */
export function Tile({
  label,
  count,
  className = "",
  children,
  labelId,
}: {
  label: string;
  count?: number;
  className?: string;
  children: ReactNode;
  labelId?: string;
}) {
  return (
    <section className={`ox-tile ${className}`} aria-labelledby={labelId}>
      <header className="ox-tile__head">
        <h3 className="ox-tile__label" id={labelId}>
          {label}
        </h3>
        {count != null && <span className="ox-count">{count}</span>}
      </header>
      <div className="ox-tile__body">{children}</div>
    </section>
  );
}

/** Small number tile for bento stat rows. */
export function StatTile({ value, label, tone }: { value: ReactNode; label: string; tone?: "danger" | "muted" }) {
  return (
    <div className={`ox-stat-tile${tone ? ` ox-stat-tile--${tone}` : ""}`}>
      <span className="ox-stat-tile__v">{value}</span>
      <span className="ox-stat-tile__l">{label}</span>
    </div>
  );
}

/** Placeholder tiles that keep the panel's shape while data loads. */
export function PanelSkeleton({ label }: { label: string }) {
  return (
    <div className="ox-inspector__body ox-panel-bento" role="status" aria-label={`${label}…`}>
      <div className="ox-tile ox-skel" style={{ height: 132 }} />
      <div className="ox-stat-row">
        <div className="ox-tile ox-skel" style={{ height: 70 }} />
        <div className="ox-tile ox-skel" style={{ height: 70 }} />
        <div className="ox-tile ox-skel" style={{ height: 70 }} />
      </div>
      <div className="ox-tile ox-skel" style={{ height: 220 }} />
      <div className="ox-tile ox-skel" style={{ height: 160 }} />
    </div>
  );
}
