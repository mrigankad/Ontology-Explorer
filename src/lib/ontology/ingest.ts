import type { Classification, EvidenceRecord, EvidenceSource, Locator, RecordKind } from "./types";

/**
 * Lightweight import adapter: maps raw artifacts (document pages, transcripts,
 * SQL rows, image annotations, sensor scans) into EvidenceRecords while keeping
 * the source id and an exact locator, so any claim can be reproduced.
 *
 * This is deliberately not an ETL platform — call these mappers from a script or
 * a queue worker, then run `validateDataset` before committing.
 */

interface Common {
  source: EvidenceSource;
  extractor: { method: string; version: string };
  classification?: Classification;
  now?: string;
}

function base(
  c: Common,
  id: string,
  kind: RecordKind,
  title: string,
  content: string,
  locator: Locator,
  payload: EvidenceRecord["payload"] = {},
): EvidenceRecord {
  const at = c.now ?? new Date().toISOString();
  return {
    id,
    sourceId: c.source.id,
    kind,
    title,
    content,
    payload,
    locator,
    extraction: { ...c.extractor, at },
    ingestStatus: content ? "ingested" : "pending",
    // A record can never be less restricted than its source.
    classification: stricter(c.classification ?? c.source.classification, c.source.classification),
    annotations: [],
    ingestionHistory: [{ at, event: "imported", detail: `${c.extractor.method}@${c.extractor.version}` }],
    isDemo: c.source.isDemo,
    createdAt: at,
    updatedAt: at,
  };
}

const RANK: Record<Classification, number> = { public: 0, internal: 1, restricted: 2 };
export function stricter(a: Classification, b: Classification): Classification {
  return RANK[a] >= RANK[b] ? a : b;
}

export function fromDocumentPages(c: Common, pages: Array<{ page: number; paragraphs: string[] }>): EvidenceRecord[] {
  return pages.flatMap((p) => {
    let line = 1;
    return p.paragraphs.map((text, i) => {
      const lines = Math.max(1, text.split("\n").length);
      const locator: Locator = { type: "page", page: p.page, lineStart: line, lineEnd: line + lines - 1 };
      line += lines + 1;
      return base(c, `${c.source.id}:p${p.page}:${i}`, "document_passage", `Page ${p.page}, passage ${i + 1}`, text, locator);
    });
  });
}

export function fromTranscript(
  c: Common,
  segments: Array<{ startMs: number; endMs: number; speaker: string; text: string; pii?: boolean }>,
): EvidenceRecord[] {
  return segments.map((s, i) =>
    base(
      { ...c, classification: s.pii ? "restricted" : c.classification },
      `${c.source.id}:t${s.startMs}`,
      "transcript_segment",
      `${s.speaker} at ${Math.floor(s.startMs / 1000)}s`,
      s.text,
      { type: "time", startMs: s.startMs, endMs: s.endMs, speaker: s.speaker },
      { turn: i },
    ),
  );
}

export function fromSqlRows(
  c: Common,
  table: string,
  keyColumn: string,
  rows: Array<Record<string, string | number | boolean | null>>,
): EvidenceRecord[] {
  return rows.map((row) => {
    const key = String(row[keyColumn]);
    const content = Object.entries(row).map(([k, v]) => `${k}=${v}`).join(", ");
    return base(c, `${c.source.id}:${table}:${key}`, "table_row", `${table} row ${key}`, content, { type: "row", table, key }, row);
  });
}

export function fromImageAnnotations(
  c: Common,
  image: { width: number; height: number },
  boxes: Array<{ label: string; x: number; y: number; w: number; h: number; score?: number }>,
): EvidenceRecord[] {
  return boxes.map((b, i) =>
    base(
      c,
      `${c.source.id}:box${i}`,
      "image_region",
      b.label,
      `Region labelled ${b.label}`,
      { type: "bbox", x: b.x, y: b.y, w: b.w, h: b.h, imageW: image.width, imageH: image.height },
      { label: b.label, score: b.score ?? null },
    ),
  );
}

export function fromSensorExcursions(
  c: Common,
  channel: string,
  excursions: Array<{ start: string; end: string; peak: number }>,
): EvidenceRecord[] {
  return excursions.map((x) =>
    base(
      c,
      `${c.source.id}:${channel}:${x.start}`,
      "sensor_interval",
      `${channel} excursion`,
      `${channel} peaked at ${x.peak}`,
      { type: "interval", channel, start: x.start, end: x.end },
      { peak: x.peak },
    ),
  );
}
