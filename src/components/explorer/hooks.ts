"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { isAbort } from "@/lib/ontology/client";
import { parseState, serializeState, type ExplorerUrlState } from "@/lib/ontology/url-state";

type Patch = Partial<ExplorerUrlState> | ((s: ExplorerUrlState) => Partial<ExplorerUrlState>);

/**
 * URL-backed explorer state. Writes use the History API (which Next keeps in
 * sync with useSearchParams) so selection changes don't trigger server renders.
 * `push` creates a back-button step; `replace` is for filter tweaks.
 */
export function useExplorerUrl() {
  const sp = useSearchParams();
  const state = useMemo(() => parseState(new URLSearchParams(sp.toString())), [sp]);
  const update = useCallback((patch: Patch, mode: "push" | "replace" = "replace") => {
    const current = parseState(new URLSearchParams(window.location.search));
    const p = typeof patch === "function" ? patch(current) : patch;
    const qs = serializeState({ ...current, ...p });
    const url = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
    if (url === `${window.location.pathname}${window.location.search}`) return;
    window.history[mode === "push" ? "pushState" : "replaceState"](null, "", url);
  }, []);
  return [state, update] as const;
}

export interface Resource<T> {
  data: T | undefined;
  error: Error | undefined;
  loading: boolean;
  retry: () => void;
}

/**
 * Fetch keyed data with cancellation of stale requests. Changing `key` aborts
 * the previous request; `null` means "nothing to load".
 */
export function useResource<T>(key: string | null, load: (signal: AbortSignal) => Promise<T>): Resource<T> {
  const [nonce, setNonce] = useState(0);
  const [state, setState] = useState<{ key: string; data?: T; error?: Error } | null>(null);
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  });
  const fullKey = key == null ? null : `${key}#${nonce}`;
  useEffect(() => {
    if (fullKey == null) return;
    const ac = new AbortController();
    loadRef.current(ac.signal).then(
      (data) => setState({ key: fullKey, data }),
      (error: unknown) => {
        if (!isAbort(error)) setState({ key: fullKey, error: error instanceof Error ? error : new Error(String(error)) });
      },
    );
    return () => ac.abort();
  }, [fullKey]);
  const settled = state?.key === fullKey;
  const sameKey = state != null && key != null && state.key.startsWith(`${key}#`);
  return {
    data: sameKey ? state.data : undefined,
    error: settled ? state.error : undefined,
    loading: fullKey != null && !settled,
    retry: useCallback(() => setNonce((n) => n + 1), []),
  };
}

export function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export function useOnline(): boolean {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return online;
}

export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return reduced;
}
