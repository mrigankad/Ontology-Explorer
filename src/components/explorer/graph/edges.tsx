"use client";

import { memo, useState } from "react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  useInternalNode,
  useStore,
  type Edge,
  type EdgeProps,
  type InternalNode,
} from "@xyflow/react";
import type { Bundle } from "@/lib/ontology/graph-model";
import { pointAt, routePath, type Box } from "./geometry";
import type { EdgeSummary, Stance } from "@/lib/ontology/types";
import { STATE_META } from "../ui";
import { useCanvasActions } from "./canvas-context";
import type { Emphasis } from "./nodes";

export type ClaimEdgeData = { edge: EdgeSummary; emphasis: Emphasis; fromRoot: boolean; parallelIndex: number; onPath: boolean };
export type BundleEdgeData = {
  bundle: Bundle;
  dim: boolean;
  fromRoot: boolean;
  labelT: number;
  maxScale: number;
  familyLabel: (f: string) => string;
};
export type EvidenceLinkData = { stance: Stance };
export type ClaimFlowEdge = Edge<ClaimEdgeData, "claim">;
export type BundleFlowEdge = Edge<BundleEdgeData, "bundle">;
export type EvidenceFlowEdge = Edge<EvidenceLinkData, "evidenceLink">;

function box(n: InternalNode): Box {
  const w = n.measured.width ?? n.width ?? 0;
  const h = n.measured.height ?? n.height ?? 0;
  return { x: n.internals.positionAbsolute.x + w / 2, y: n.internals.positionAbsolute.y + h / 2, w, h };
}

const zoomSelector = (s: { transform: [number, number, number] }) => s.transform[2];

export const ClaimEdge = memo(function ClaimEdge({ id, source, target, data }: EdgeProps<ClaimFlowEdge>) {
  const s = useInternalNode(source);
  const t = useInternalNode(target);
  const zoom = useStore(zoomSelector);
  const { selectEdge } = useCanvasActions();
  if (!s || !t || !data) return null;
  const { edge, emphasis, fromRoot, parallelIndex, onPath } = data;
  const route = routePath(box(s), box(t), parallelIndex * 36, !fromRoot);
  const { path } = route;
  const { x: lx, y: ly } = pointAt(route, 0.5);
  const state = edge.evidenceState;
  const strong = emphasis === "selected" || emphasis === "near";
  const showLabel = strong || (zoom >= 1.35 && emphasis !== "dim");
  const cls = `ox-edge ox-edge--${state} is-${emphasis}${fromRoot ? " is-root" : ""}`;
  // Keep labels a constant on-screen size while zoomed out.
  const scale = Math.min(1 / zoom, 1.7);
  return (
    <>
      {/* The traversal trail gets a warm halo underneath, keeping the evidence styling on top. */}
      {onPath && emphasis !== "dim" && (
        <>
          <path d={path} className="ox-edge-halo" />
          <path d={path} className="ox-edge-flow" />
        </>
      )}
      <BaseEdge id={id} path={path} className={cls} markerEnd={`url(#ox-arrow-${state}${strong ? "-lg" : ""})`} interactionWidth={18} />
      {showLabel && (
        <EdgeLabelRenderer>
          <button
            type="button"
            className={`ox-edge-label ox-edge-label--${state} is-${emphasis} nodrag nopan`}
            style={{ transform: `translate(-50%, -50%) translate(${lx}px, ${ly}px) scale(${scale})` }}
            onClick={(e) => {
              e.stopPropagation();
              selectEdge(edge.id);
            }}
            tabIndex={-1}
          >
            <span aria-hidden="true">{STATE_META[state].glyph}</span> {edge.label}
          </button>
        </EdgeLabelRenderer>
      )}
    </>
  );
});

/**
 * One band per family pair. Width grows with the number of links; the gradient
 * runs from the source family's hue to the target's, so you can read which
 * families connect without reading labels.
 */
export const BundleEdge = memo(function BundleEdge({ id, source, target, data }: EdgeProps<BundleFlowEdge>) {
  const s = useInternalNode(source);
  const t = useInternalNode(target);
  const zoom = useStore(zoomSelector);
  const { toggleBundle, hoverBundle } = useCanvasActions();
  const [hover, setHoverState] = useState(false);
  const setHover = (v: boolean) => {
    setHoverState(v);
    hoverBundle(v ? (data?.bundle.id ?? null) : null);
  };
  if (!s || !t || !data) return null;
  const { bundle, dim, fromRoot, labelT, maxScale, familyLabel } = data;
  // A faded band can't be hovered, even if its last pointer-leave was missed.
  const hot = hover && !dim;
  const n = bundle.edges.length;
  const route = routePath(box(s), box(t), 0, !fromRoot);
  const { path, p1, p2, q } = route;
  const { x: lx, y: ly } = pointAt(route, labelT);
  const width = 2 + Math.sqrt(n) * 2.2;
  // Arrowheads show which way the links run: at the target for forward links,
  // and at the source too when some links point back.
  const head = width * 1.6 + 9;
  const gid = `ox-bg-${id.replace(/[^a-z0-9-]/gi, "")}`;
  const scale = Math.min(1 / zoom, maxScale);
  const total = n || 1;
  const segs = (["linked", "none", "disputed", "verified"] as const).filter((k) => bundle.byState[k] > 0);
  const summary = `${familyLabel(bundle.from)} to ${familyLabel(bundle.to)}: ${n} ${n === 1 ? "link" : "links"}`;
  return (
    <>
      <defs>
        <linearGradient id={gid} gradientUnits="userSpaceOnUse" x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}>
          <stop offset="0" style={{ stopColor: `var(--fam-${bundle.from})` }} />
          <stop offset="1" style={{ stopColor: `var(--fam-${bundle.to})` }} />
        </linearGradient>
      </defs>
      <BaseEdge
        id={id}
        path={path}
        className={`ox-bundle${dim ? " is-dim" : ""}${hot ? " is-hover" : ""}`}
        style={{ stroke: `url(#${gid})`, strokeWidth: width }}
        interactionWidth={Math.max(18, width + 8)}
      />
      {bundle.forward > 0 && (
        <path d={arrowHead(p2, q, head)} className={`ox-bundle-head${dim ? " is-dim" : ""}${hot ? " is-hover" : ""}`} style={{ fill: `var(--fam-${bundle.to})`, stroke: `var(--fam-${bundle.to})` }} />
      )}
      {bundle.backward > 0 && (
        <path d={arrowHead(p1, q, head)} className={`ox-bundle-head${dim ? " is-dim" : ""}${hot ? " is-hover" : ""}`} style={{ fill: `var(--fam-${bundle.from})`, stroke: `var(--fam-${bundle.from})` }} />
      )}
      <EdgeLabelRenderer>
        <div
          className={`ox-bundle-tag${dim ? " is-dim" : ""}${hot ? " is-hover" : ""} nodrag nopan`}
          style={{ transform: `translate(-50%, -50%) translate(${lx}px, ${ly}px) scale(${scale})` }}
          onPointerEnter={() => setHover(true)}
          onPointerLeave={() => setHover(false)}
        >
          <button
            type="button"
            className="ox-bundle-tag__btn"
            onClick={(e) => {
              // React events bubble through the label portal to the edge's own
              // click handler, which would toggle the band straight back.
              e.stopPropagation();
              toggleBundle(bundle.id);
            }}
            onFocus={() => setHover(true)}
            onBlur={() => setHover(false)}
            aria-label={`${summary}. Show the individual links.`}
          >
            <span className="ox-bundle-tag__n">{n}</span>
            <span className="ox-bundle-tag__bar" aria-hidden="true">
              {segs.map((k) => (
                <span key={k} className={`ox-bundle-tag__seg ox-bundle-tag__seg--${k}`} style={{ flexGrow: bundle.byState[k] / total }} />
              ))}
            </span>
          </button>
          {hot && (
            <div className="ox-bundle-tip" role="tooltip">
              <strong>{summary}</strong>
              <ul>
                {bundle.relations.map((r) => (
                  <li key={r.label}>
                    <span>{r.label}</span>
                    <span>{r.count}</span>
                  </li>
                ))}
              </ul>
              <p>
                {segs.map((k) => `${bundle.byState[k]} ${STATE_META[k].label.toLowerCase()}`).join(", ")}
              </p>
              {bundle.backward > 0 && bundle.forward > 0 && (
                <p>
                  {bundle.forward} point to {familyLabel(bundle.to)}, {bundle.backward} point back
                </p>
              )}
              <p className="ox-bundle-tip__hint">Click to show each link</p>
            </div>
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  );
});

export const EvidenceLinkEdge = memo(function EvidenceLinkEdge({ id, source, target, data }: EdgeProps<EvidenceFlowEdge>) {
  const s = useInternalNode(source);
  const t = useInternalNode(target);
  if (!s || !t || !data) return null;
  const { path } = routePath(box(s), box(t), 0, false);
  return <BaseEdge id={id} path={path} className={`ox-evlink ox-evlink--${data.stance}`} />;
});

export const edgeTypes = { claim: ClaimEdge, bundle: BundleEdge, evidenceLink: EvidenceLinkEdge };

/**
 * Notched arrowhead with its tip at `tip`, pointing away from `from` (the
 * curve's control point, so it follows the band's direction as it arrives).
 */
function arrowHead(tip: { x: number; y: number }, from: { x: number; y: number }, size: number): string {
  const dx = tip.x - from.x;
  const dy = tip.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const bx = tip.x - ux * size;
  const by = tip.y - uy * size;
  const half = size * 0.55;
  const notchX = tip.x - ux * size * 0.72;
  const notchY = tip.y - uy * size * 0.72;
  return `M ${tip.x},${tip.y} L ${bx - uy * half},${by + ux * half} L ${notchX},${notchY} L ${bx + uy * half},${by - ux * half} Z`;
}

/**
 * Arrowheads for individual links, one per evidence state, in two sizes. They
 * use fixed user-space units, so thin lines still get arrows you can see.
 */
export function EdgeMarkers() {
  const states = ["verified", "linked", "none", "disputed"] as const;
  const sizes = [
    { suffix: "", size: 13 },
    { suffix: "-lg", size: 17 },
  ];
  return (
    <svg className="ox-markers" aria-hidden="true" width="0" height="0">
      <defs>
        {states.flatMap((s) =>
          sizes.map(({ suffix, size }) => (
            <marker
              key={s + suffix}
              id={`ox-arrow-${s}${suffix}`}
              viewBox="0 0 14 14"
              refX="13"
              refY="7"
              markerUnits="userSpaceOnUse"
              markerWidth={size}
              markerHeight={size}
              orient="auto-start-reverse"
            >
              <path d="M 2 2.5 L 12.5 7 L 2 11.5 L 4.5 7 Z" className={`ox-marker ox-marker--${s}`} />
            </marker>
          )),
        )}
      </defs>
    </svg>
  );
}
