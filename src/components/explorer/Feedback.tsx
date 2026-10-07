"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { EvidenceState, OntologyType, RelationType } from "@/lib/ontology/types";
import type { ExplorerUrlState } from "@/lib/ontology/url-state";
import { Icon } from "./controls";
import { STATE_META, familyVars } from "./ui";

// ---------------------------------------------------------------------------
// Toasts: short, visible confirmation of what just happened, with an optional
// action (usually Undo). The region is also the polite live region.
// ---------------------------------------------------------------------------

export interface Toast {
  id: number;
  text: string;
  action?: { label: string; run: () => void };
}

export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seq = useRef(0);
  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const notify = useCallback((text: string, action?: Toast["action"]) => {
    const id = ++seq.current;
    // Keep at most three; the newest replaces the oldest.
    setToasts((t) => [...t.slice(-2), { id, text, action }]);
  }, []);
  return { toasts, notify, dismiss };
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: number) => void }) {
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused) return;
    // Longer when there's something to act on.
    const t = setTimeout(() => onDismiss(toast.id), toast.action ? 7000 : 4000);
    return () => clearTimeout(t);
  }, [paused, toast, onDismiss]);
  return (
    <li
      className="ox-toast"
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <span className="ox-toast__text">{toast.text}</span>
      {toast.action && (
        <button
          type="button"
          className="ox-toast__action"
          onClick={() => {
            toast.action!.run();
            onDismiss(toast.id);
          }}
        >
          {toast.action.label}
        </button>
      )}
      <button type="button" className="ox-toast__close" aria-label="Dismiss" onClick={() => onDismiss(toast.id)}>
        <Icon name="close" size={14} />
      </button>
    </li>
  );
}

export function Toasts({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  return (
    <ol className="ox-toasts" role="status" aria-live="polite" aria-label="Notifications">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </ol>
  );
}

// ---------------------------------------------------------------------------
// Active filter chips: always show why things are missing, one click to undo.
// ---------------------------------------------------------------------------

interface ChipsProps {
  state: ExplorerUrlState;
  types: OntologyType[];
  relationTypes: RelationType[];
  labelOf: (id: string) => string;
  onChange: (patch: Partial<ExplorerUrlState>) => void;
  onClearAll: () => void;
}

export function FilterChips({ state, types, relationTypes, labelOf, onChange, onClearAll }: ChipsProps) {
  const chips: Array<{ key: string; label: string; remove: () => void; style?: React.CSSProperties }> = [];
  for (const f of state.hideFamilies) {
    const t = types.find((x) => x.family === f);
    chips.push({
      key: `fam:${f}`,
      label: `Hiding ${t?.pluralLabel ?? f}`,
      style: familyVars(t?.family ?? "company"),
      remove: () => onChange({ hideFamilies: state.hideFamilies.filter((x) => x !== f) }),
    });
  }
  if (state.states.length) {
    chips.push({
      key: "states",
      label: `Only ${state.states.map((s: EvidenceState) => STATE_META[s].label.toLowerCase()).join(" or ")}`,
      remove: () => onChange({ states: [] }),
    });
  }
  if (state.rels.length) {
    chips.push({
      key: "rels",
      label: `Only ${state.rels.map((r) => relationTypes.find((x) => x.id === r)?.label ?? r).join(", ")}`,
      remove: () => onChange({ rels: [] }),
    });
  }
  if (state.focus) chips.push({ key: "focus", label: `Near ${labelOf(state.focus)}`, remove: () => onChange({ focus: null }) });
  if (state.isolate && state.node) {
    chips.push({ key: "iso", label: `Only ${labelOf(state.node)} and its links`, remove: () => onChange({ isolate: false }) });
  }
  if (state.hidden.length) {
    chips.push({
      key: "hidden",
      label: state.hidden.length === 1 ? `${labelOf(state.hidden[0])} hidden` : `${state.hidden.length} entities hidden`,
      remove: () => onChange({ hidden: [] }),
    });
  }
  if (!chips.length) return null;
  return (
    <div className="ox-chips" role="group" aria-label="Active filters">
      {chips.map((c) => (
        <span key={c.key} className="ox-chip" style={c.style}>
          {c.label}
          <button type="button" className="ox-chip__x" aria-label={`Remove filter: ${c.label}`} onClick={c.remove}>
            <Icon name="close" size={12} />
          </button>
        </span>
      ))}
      {chips.length > 1 && (
        <button type="button" className="ox-chips__clear" onClick={onClearAll}>
          Clear all
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Recently viewed: per-viewer convenience kept in localStorage.
// useSyncExternalStore keeps server and first client render identical.
// ---------------------------------------------------------------------------

export interface RecentItem {
  kind: "node" | "edge";
  id: string;
  label: string;
}

const RECENT_KEY = "wayam-explorer-recent-v1";
const listeners = new Set<() => void>();

function readRecent(): string {
  try {
    return window.localStorage.getItem(RECENT_KEY) ?? "[]";
  } catch {
    return "[]";
  }
}

export function pushRecent(item: RecentItem) {
  try {
    const list = JSON.parse(readRecent()) as RecentItem[];
    const next = [item, ...list.filter((x) => !(x.kind === item.kind && x.id === item.id))].slice(0, 6);
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    listeners.forEach((l) => l());
  } catch {
    // Storage unavailable: recents are a convenience, so skip silently.
  }
}

export function useRecent(): RecentItem[] {
  const raw = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    readRecent,
    () => "[]",
  );
  try {
    return JSON.parse(raw) as RecentItem[];
  } catch {
    return [];
  }
}
