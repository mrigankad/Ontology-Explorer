import "server-only";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ROLE_COOKIE, resolveViewer } from "./access";
import type { Viewer } from "./types";

/** Resolve the caller. Swap for the real session/tenant lookup when auth exists. */
export async function getViewer(): Promise<Viewer> {
  const jar = await cookies();
  return resolveViewer(jar.get(ROLE_COOKIE)?.value);
}

export function ok<T>(body: T, classification = "internal") {
  return NextResponse.json(body, {
    headers: { "cache-control": "private, no-store", "x-data-classification": classification },
  });
}

/** Same response for "missing" and "forbidden" so ids can't be probed. */
export function notFound(what: string) {
  return NextResponse.json({ error: "not_found", message: `${what} was not found or you do not have access to it.` }, { status: 404 });
}

export function badRequest(message: string) {
  return NextResponse.json({ error: "bad_request", message }, { status: 400 });
}

export function intParam(value: string | null, fallback: number, min: number, max: number): number | null {
  if (value == null || value === "") return fallback;
  const n = Number(value);
  if (!Number.isInteger(n) || n < min || n > max) return null;
  return n;
}
