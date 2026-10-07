"use client";

import { useEffect, useRef } from "react";
import type { EvidenceRecord, EvidenceSource, Locator, SourcePreview as Preview } from "@/lib/ontology/types";
import { formatMs } from "./ui";

interface Props {
  source: EvidenceSource;
  preview: Preview | null;
  previewError: Error | null;
  record: EvidenceRecord;
  /** Other visible records from the same source, so regions/segments can be shown together. */
  siblings: Array<{ id: string; title: string; locator: Locator }>;
  onOpenRecord: (id: string) => void;
}

export function SourcePreview({ source, preview, previewError, record, siblings, onOpenRecord }: Props) {
  if (previewError || !preview) {
    return (
      <Fallback
        title={previewError ? "Preview unavailable" : "Loading preview…"}
        body={previewError ? `${previewError.message} The record's metadata and extracted content are still shown.` : undefined}
        source={source}
      />
    );
  }
  const l = record.locator;
  return (
    <div className="ox-preview">
      {!preview.available && (
        <div className="ox-preview__notice" role="note">
          <strong>Original file not available.</strong> {preview.reason}
        </div>
      )}
      {preview.pages && l.type === "page" && <Pages pages={preview.pages} locator={l} />}
      {preview.scene && l.type === "bbox" && (
        <Scene scene={preview.scene} active={record} siblings={siblings} onOpenRecord={onOpenRecord} />
      )}
      {preview.transcript && l.type === "time" && (
        <Transcript transcript={preview.transcript} durationMs={preview.durationMs ?? 0} locator={l} />
      )}
      {preview.table && l.type === "row" && <Table table={preview.table} locator={l} />}
      {preview.series && l.type === "interval" && <Series series={preview.series} locator={l} />}
    </div>
  );
}

function Fallback({ title, body, source }: { title: string; body?: string; source: EvidenceSource }) {
  return (
    <div className="ox-preview ox-preview--fallback">
      <p className="ox-preview__fallback-title">{title}</p>
      {body && <p className="ox-small">{body}</p>}
      <dl className="ox-dl ox-dl--grid">
        <dt>Type</dt>
        <dd>{source.mimeType}</dd>
        <dt>Stored at</dt>
        <dd className="ox-mono">{source.uri}</dd>
      </dl>
    </div>
  );
}

function Pages({ pages, locator }: { pages: NonNullable<Preview["pages"]>; locator: Extract<Locator, { type: "page" }> }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.querySelector(".is-hit")?.scrollIntoView({ block: "nearest" });
  }, [locator]);
  return (
    <div className="ox-pages" ref={ref}>
      {pages.map((p) => (
        <article key={p.page} className={`ox-page${p.page === locator.page ? " is-current" : ""}`} aria-label={`Page ${p.page}`}>
          <span className="ox-page__no">p. {p.page}</span>
          <ol className="ox-page__lines">
            {p.lines.map((line, i) => {
              const n = i + 1;
              const hit = p.page === locator.page && n >= locator.lineStart && n <= locator.lineEnd;
              return (
                <li key={i} className={hit ? "is-hit" : undefined}>
                  <span className="ox-page__ln" aria-hidden="true">
                    {n}
                  </span>
                  <span>{line || " "}</span>
                  {hit && <span className="sr-only"> (cited line)</span>}
                </li>
              );
            })}
          </ol>
        </article>
      ))}
    </div>
  );
}

function Scene({
  scene,
  active,
  siblings,
  onOpenRecord,
}: {
  scene: NonNullable<Preview["scene"]>;
  active: EvidenceRecord;
  siblings: Props["siblings"];
  onOpenRecord: (id: string) => void;
}) {
  const regions = [
    { id: active.id, title: active.title, locator: active.locator, current: true },
    ...siblings.filter((s) => s.locator.type === "bbox").map((s) => ({ ...s, current: false })),
  ];
  return (
    <figure className="ox-scene">
      <svg viewBox={`0 0 ${scene.width} ${scene.height}`} role="group" aria-label={scene.description}>
        {/* Rendered stand-in for the image file: haul road, walkway, truck, pedestrian. */}
        <rect width="1280" height="720" className="ox-scene__sky" />
        <rect y="300" width="1280" height="420" className="ox-scene__ground" />
        <polygon points="560,300 760,300 1280,720 260,720" className="ox-scene__road" />
        <polygon points="300,300 470,300 330,720 40,720" className="ox-scene__walk" />
        <g className="ox-scene__truck">
          <rect x="680" y="250" width="380" height="190" rx="10" />
          <rect x="1000" y="300" width="100" height="140" rx="8" />
          <circle cx="760" cy="470" r="42" />
          <circle cx="1020" cy="470" r="42" />
        </g>
        <g className="ox-scene__person">
          <circle cx="410" cy="290" r="26" />
          <rect x="384" y="320" width="54" height="120" rx="14" />
          <rect x="388" y="436" width="18" height="80" rx="6" />
          <rect x="416" y="436" width="18" height="80" rx="6" />
        </g>
        {regions.map((r) => {
          if (r.locator.type !== "bbox") return null;
          const { x, y, w, h } = r.locator;
          return (
            <g
              key={r.id}
              className={`ox-bbox${r.current ? " is-current" : ""}`}
              onClick={() => !r.current && onOpenRecord(r.id)}
              onKeyDown={(e) => {
                if (!r.current && (e.key === "Enter" || e.key === " ")) {
                  e.preventDefault();
                  onOpenRecord(r.id);
                }
              }}
              role={r.current ? "img" : "button"}
              tabIndex={r.current ? undefined : 0}
              aria-label={r.current ? `Cited region: ${r.title}` : `Open region: ${r.title}`}
            >
              <rect x={x} y={y} width={w} height={h} />
              <text x={x + 6} y={y - 10}>
                {r.title}
              </text>
            </g>
          );
        })}
      </svg>
      <figcaption className="ox-small ox-muted">
        Rendered stand-in for the demo image. Boxes are drawn from the stored pixel locators.
      </figcaption>
    </figure>
  );
}

function Transcript({
  transcript,
  durationMs,
  locator,
}: {
  transcript: NonNullable<Preview["transcript"]>;
  durationMs: number;
  locator: Extract<Locator, { type: "time" }>;
}) {
  const overlaps = (s: { startMs: number; endMs: number }) => s.startMs < locator.endMs && s.endMs > locator.startMs;
  const pct = (ms: number) => `${(ms / (durationMs || 1)) * 100}%`;
  return (
    <div className="ox-audio">
      <div className="ox-timeline" aria-label={`Cited span ${formatMs(locator.startMs)} to ${formatMs(locator.endMs)} of ${formatMs(durationMs)}`} role="img">
        {transcript.map((s, i) => (
          <span key={i} className={`ox-timeline__seg${s.redacted ? " is-redacted" : ""}`} style={{ left: pct(s.startMs), width: pct(s.endMs - s.startMs) }} />
        ))}
        <span className="ox-timeline__hit" style={{ left: pct(locator.startMs), width: pct(locator.endMs - locator.startMs) }} />
        <span className="ox-timeline__t ox-timeline__t--start">00:00</span>
        <span className="ox-timeline__t ox-timeline__t--end">{formatMs(durationMs)}</span>
      </div>
      <ol className="ox-transcript">
        {transcript.map((s, i) => (
          <li key={i} className={`${overlaps(s) ? "is-hit" : ""}${s.redacted ? " is-redacted" : ""}`}>
            <span className="ox-transcript__t">{formatMs(s.startMs)}</span>
            <span className="ox-transcript__who">{s.speaker}</span>
            <span className="ox-transcript__text">{s.text}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function Table({ table, locator }: { table: NonNullable<Preview["table"]>; locator: Extract<Locator, { type: "row" }> }) {
  const keyCol = table.columns[0];
  return (
    <div className="ox-tablewrap" tabIndex={0} aria-label={`Rows of ${locator.table}`}>
      <table className="ox-table ox-table--compact">
        <caption className="ox-small ox-muted">{locator.table}</caption>
        <thead>
          <tr>
            {table.columns.map((c) => (
              <th key={c} scope="col">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((r) => (
            <tr key={String(r[keyCol])} className={String(r[keyCol]) === locator.key ? "is-hit" : undefined}>
              {table.columns.map((c) => (
                <td key={c} className="ox-mono">
                  {String(r[c])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Series({ series, locator }: { series: NonNullable<Preview["series"]>; locator: Extract<Locator, { type: "interval" }> }) {
  const W = 640;
  const H = 200;
  const P = 28;
  const pts = series.points;
  const t0 = Date.parse(pts[0].t);
  const t1 = Date.parse(pts[pts.length - 1].t);
  const vmax = Math.max(...pts.map((p) => p.v)) * 1.1;
  const x = (t: string) => P + ((Date.parse(t) - t0) / (t1 - t0)) * (W - P * 2);
  const y = (v: number) => H - P - (v / vmax) * (H - P * 2);
  const d = pts.map((p, i) => `${i ? "L" : "M"} ${x(p.t).toFixed(1)} ${y(p.v).toFixed(1)}`).join(" ");
  const peak = Math.max(...pts.filter((p) => p.t >= locator.start && p.t <= locator.end).map((p) => p.v));
  return (
    <figure className="ox-series">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${series.channel} over time. Cited interval peaks at ${peak} ${series.unit}.`}>
        <rect x={x(locator.start)} y={P / 2} width={x(locator.end) - x(locator.start)} height={H - P * 1.5} className="ox-series__hit" />
        <line x1={P} x2={W - P} y1={H - P} y2={H - P} className="ox-series__axis" />
        <path d={d} className="ox-series__line" />
        <text x={P} y={16} className="ox-series__label">
          {series.channel} ({series.unit})
        </text>
      </svg>
      <figcaption className="ox-small ox-muted">Shaded band is the cited interval.</figcaption>
    </figure>
  );
}
