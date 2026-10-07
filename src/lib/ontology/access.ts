import type { Classification, Viewer, ViewerRole } from "./types";

/**
 * Server-side access policy. Every repository read passes through `canSee`, so
 * restricted items never reach counts, previews, exports or direct URLs.
 *
 * Demo mode has no real auth: the viewer role comes from a cookie so the policy
 * can be exercised. Replace `resolveViewer` with the app's session lookup and
 * tenant check when wiring real auth.
 */

export const ROLE_COOKIE = "wayam-demo-role";

const CLEARANCE: Record<ViewerRole, Classification[]> = {
  analyst: ["public", "internal"],
  admin: ["public", "internal", "restricted"],
};

export function viewerFor(role: ViewerRole): Viewer {
  return { id: `demo-${role}`, role, clearance: CLEARANCE[role] };
}

export function resolveViewer(roleValue: string | undefined | null): Viewer {
  return viewerFor(roleValue === "admin" ? "admin" : "analyst");
}

export function canSee(viewer: Viewer, classification: Classification): boolean {
  return viewer.clearance.includes(classification);
}
