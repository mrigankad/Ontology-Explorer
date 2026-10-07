"use client";

import { createContext, useContext } from "react";
import type { FamilyId, RecordKind } from "@/lib/ontology/types";

/**
 * Generated icon set (docs/icon-prompts.md). The server lists which PNGs exist
 * in public/icons, so nothing is requested unless it's there. Every lookup
 * falls back: entity's own icon → its family's icon → the text glyph.
 */
export const IconSetContext = createContext<ReadonlySet<string>>(new Set());

export const familyIconKey = (f: FamilyId) => `family-${f}`;
export const recordIconKey = (k: RecordKind) => `record-${k.replace(/_/g, "-")}`;

function useFirstAvailable(keys: string[]): string | null {
  const available = useContext(IconSetContext);
  return keys.find((k) => available.has(k)) ?? null;
}

export function EntityIcon({
  id,
  family,
  glyph,
  size = 16,
  className = "",
}: {
  id?: string;
  family: FamilyId;
  glyph: string;
  size?: number;
  className?: string;
}) {
  const key = useFirstAvailable([...(id ? [id] : []), familyIconKey(family)]);
  if (key) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- tiny local PNGs; next/image adds nothing here
      <img className={`ox-eicon ${className}`} src={`/icons/${key}.png`} width={size} height={size} alt="" aria-hidden="true" draggable={false} />
    );
  }
  return (
    <span className={`ox-eicon ox-eicon--glyph ${className}`} style={{ fontSize: Math.round(size * 0.7) }} aria-hidden="true">
      {glyph}
    </span>
  );
}

export function RecordIcon({ kind, size = 16 }: { kind: RecordKind; size?: number }) {
  const key = useFirstAvailable([recordIconKey(kind)]);
  if (!key) return null;
  // eslint-disable-next-line @next/next/no-img-element -- tiny local PNGs
  return <img className="ox-eicon" src={`/icons/${key}.png`} width={size} height={size} alt="" aria-hidden="true" draggable={false} />;
}
