/**
 * Pure path geometry shared by the edge renderers and the canvas' label planner.
 * All coordinates are flow coordinates; the company node sits at the origin.
 */

export interface Box {
  /** Centre x/y and full width/height. */
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Route {
  path: string;
  p1: { x: number; y: number };
  p2: { x: number; y: number };
  /** Quadratic control point (equals the midpoint for straight links). */
  q: { x: number; y: number };
}

/** Links that don't touch the company node bend to keep this much clear space around it. */
export const CLEARANCE = 200;

/** Point where the line from a box's centre toward `to` leaves the box. */
function borderPoint(c: Box, to: { x: number; y: number }, pad = 4) {
  const dx = to.x - c.x;
  const dy = to.y - c.y;
  if (!dx && !dy) return { x: c.x, y: c.y };
  const s = Math.min((c.w / 2 + pad) / Math.abs(dx || 1e-9), (c.h / 2 + pad) / Math.abs(dy || 1e-9));
  return { x: c.x + dx * s, y: c.y + dy * s };
}

/**
 * Curved route between two boxes. `bend` offsets the curve sideways (separates
 * parallel claims). With `avoidCentre`, a link that would pass through the
 * company node is bowed away from it so the middle of the canvas stays clear.
 */
export function routePath(a: Box, b: Box, bend = 0, avoidCentre = true): Route {
  const p1 = borderPoint(a, b);
  const p2 = borderPoint(b, a);
  const mx = (p1.x + p2.x) / 2;
  const my = (p1.y + p2.y) / 2;
  const len = Math.hypot(p2.x - p1.x, p2.y - p1.y) || 1;
  let nx = -(p2.y - p1.y) / len;
  let ny = (p2.x - p1.x) / len;
  let offset = bend;
  if (avoidCentre) {
    const t = Math.max(0, Math.min(1, -(p1.x * (p2.x - p1.x) + p1.y * (p2.y - p1.y)) / (len * len)));
    const d = Math.hypot(p1.x + (p2.x - p1.x) * t, p1.y + (p2.y - p1.y) * t);
    if (d < CLEARANCE) {
      // Bow away from the origin. A quadratic's midpoint moves half the control offset.
      if (nx * mx + ny * my < 0 || (Math.abs(mx) < 1 && Math.abs(my) < 1 && nx < 0)) {
        nx = -nx;
        ny = -ny;
      }
      offset += (CLEARANCE - d) * 2 + 20;
    }
  }
  if (!offset) return { path: `M ${p1.x},${p1.y} L ${p2.x},${p2.y}`, p1, p2, q: { x: mx, y: my } };
  const q = { x: mx + nx * offset, y: my + ny * offset };
  return { path: `M ${p1.x},${p1.y} Q ${q.x},${q.y} ${p2.x},${p2.y}`, p1, p2, q };
}

/** Point at parameter t along a route. */
export function pointAt(r: Route, t: number) {
  const u = 1 - t;
  return {
    x: u * u * r.p1.x + 2 * u * t * r.q.x + t * t * r.p2.x,
    y: u * u * r.p1.y + 2 * u * t * r.q.y + t * t * r.p2.y,
  };
}

const CANDIDATES = [0.5, 0.38, 0.62, 0.28, 0.72, 0.2, 0.8];

/**
 * Choose where each label sits along its route so labels don't overlap each
 * other or the obstacles (e.g. the company node). Greedy, in the given order,
 * so the result is stable. Returns t per route id.
 */
export function planLabels(
  routes: Array<{ id: string; route: Route }>,
  size: { w: number; h: number },
  obstacles: Box[] = [],
): Map<string, number> {
  const placed: Box[] = [...obstacles];
  const out = new Map<string, number>();
  const hit = (b: Box) => placed.some((o) => Math.abs(o.x - b.x) * 2 < o.w + b.w && Math.abs(o.y - b.y) * 2 < o.h + b.h);
  for (const { id, route } of routes) {
    let chosen = 0.5;
    for (const t of CANDIDATES) {
      const p = pointAt(route, t);
      if (!hit({ ...p, ...size })) {
        chosen = t;
        break;
      }
    }
    out.set(id, chosen);
    placed.push({ ...pointAt(route, chosen), ...size });
  }
  return out;
}
