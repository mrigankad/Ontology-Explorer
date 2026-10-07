"use client";

import { memo } from "react";
import { Handle, NodeToolbar, Position, useStore, type Node, type NodeProps } from "@xyflow/react";
import type { EntitySummary, EvidenceRow, FamilyId } from "@/lib/ontology/types";
import { familyVars, KIND_LABEL, StanceBadge, totalEvidence, EvidenceSummary } from "../ui";
import { EntityIcon } from "../EntityIcon";
import { useCanvasActions } from "./canvas-context";

export type Emphasis = "normal" | "dim" | "near" | "selected";

export type EntityNodeData = {
  entity: EntitySummary;
  glyph: string;
  typeLabel: string;
  isRoot: boolean;
  emphasis: Emphasis;
  hovered: boolean;
  hiddenLinks: number;
  /** 1-based position on the traversal trail, or null when not on it. */
  pathStep: number | null;
};

export type ZoneNodeData = {
  family: FamilyId;
  label: string;
  count: number;
  visible: number;
  glyph: string;
  dim: boolean;
  /** One of the two families joined by the band under the pointer. */
  hot: boolean;
  compact: boolean;
};
export type EvidenceNodeData = { row: EvidenceRow };

export type EntityFlowNode = Node<EntityNodeData, "entity">;
export type ZoneFlowNode = Node<ZoneNodeData, "zone">;
export type EvidenceFlowNode = Node<EvidenceNodeData, "evidence">;

const hidden = { opacity: 0, width: 1, height: 1, minWidth: 0, minHeight: 0, border: 0, top: "50%", left: "50%" };

function Handles() {
  return (
    <>
      <Handle type="target" position={Position.Top} style={hidden} isConnectable={false} />
      <Handle type="source" position={Position.Bottom} style={hidden} isConnectable={false} />
    </>
  );
}

export const EntityNode = memo(function EntityNode({ data }: NodeProps<EntityFlowNode>) {
  const { entity, glyph, isRoot, emphasis, hovered, hiddenLinks, typeLabel, pathStep } = data;
  const { expand } = useCanvasActions();
  const evidence = totalEvidence(entity.evidence);
  const cls = [
    "ox-node",
    isRoot && "ox-node--root",
    `is-${emphasis}`,
    pathStep != null && "is-on-path",
    entity.evidence.contradicts > 0 && "has-dispute",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <div className={cls} style={familyVars(entity.family)}>
      <Handles />
      {pathStep != null && (
        <span className="ox-node__step" title={`Step ${pathStep} of your trail`} aria-hidden="true">
          {pathStep}
        </span>
      )}
      {isRoot ? (
        // eslint-disable-next-line @next/next/no-img-element -- static brand SVG
        <img className="ox-node__logo" src="/brand/wayam-glyph.svg" width={26} height={26} alt="" aria-hidden="true" />
      ) : (
        <EntityIcon id={entity.id} family={entity.family} glyph={glyph} size={18} className="ox-node__glyph" />
      )}
      <span className="ox-node__label">{entity.label}</span>
      {evidence > 0 && !isRoot && (
        <span className="ox-node__ev" aria-hidden="true" title={`${evidence} evidence links`}>
          {evidence}
        </span>
      )}
      {hiddenLinks > 0 && (
        <button
          type="button"
          className="ox-node__more nodrag"
          tabIndex={-1}
          title={`${hiddenLinks} more ${hiddenLinks === 1 ? "link" : "links"} not shown. Click to load them.`}
          aria-label={`Load ${hiddenLinks} more links for ${entity.label}`}
          onClick={(e) => {
            e.stopPropagation();
            expand(entity.id);
          }}
        >
          +{hiddenLinks}
        </button>
      )}
      <NodeToolbar isVisible={hovered && emphasis !== "selected"} position={Position.Top} offset={8}>
        <div className="ox-peek" role="tooltip">
          <span className="ox-peek__type">
            <span aria-hidden="true">{glyph}</span> {typeLabel}
          </span>
          <strong className="ox-peek__title">{entity.label}</strong>
          <span className="ox-peek__line">
            {entity.degree} links. <EvidenceSummary counts={entity.evidence} />
          </span>
          <span className="ox-peek__hint">Click to inspect, double-click to expand</span>
        </div>
      </NodeToolbar>
    </div>
  );
});

const zoomSelector = (s: { transform: [number, number, number] }) => s.transform[2];

export const ZoneNode = memo(function ZoneNode({ data }: NodeProps<ZoneFlowNode>) {
  const zoom = useStore(zoomSelector);
  // Headings grow as you zoom out so family names stay legible on the overview.
  const headScale = Math.min(Math.max(1 / zoom, 1), 1.6);
  const countText = data.visible === data.count ? String(data.count) : `${data.visible} of ${data.count}`;
  if (data.compact) {
    // Semantic zoom: far out, a zone reads as one labelled block.
    return (
      <div className={`ox-zone ox-zone--compact${data.dim ? " is-dim" : ""}${data.hot ? " is-hot" : ""}`} style={familyVars(data.family)} aria-hidden="true">
        <Handles />
        <div className="ox-zone__big" style={{ fontSize: `${Math.min(15 / zoom, 48)}px` }}>
          <EntityIcon family={data.family} glyph={data.glyph} size={20} className="ox-zone__glyph" />
          <span className="ox-zone__label">{data.label}</span>
          <span className="ox-zone__count">{countText}</span>
        </div>
      </div>
    );
  }
  return (
    <div className={`ox-zone${data.dim ? " is-dim" : ""}${data.hot ? " is-hot" : ""}`} style={familyVars(data.family)} aria-hidden="true">
      <Handles />
      <div className="ox-zone__head" style={{ fontSize: `${headScale}em` }}>
        <EntityIcon family={data.family} glyph={data.glyph} size={20} className="ox-zone__glyph" />
        <span className="ox-zone__label">{data.label}</span>
        <span className="ox-zone__count">{countText}</span>
      </div>
    </div>
  );
});

export const EvidenceNode = memo(function EvidenceNode({ data }: NodeProps<EvidenceFlowNode>) {
  const { openRecord } = useCanvasActions();
  const { row } = data;
  return (
    <div className="ox-evnode">
      <Handles />
      <button type="button" className="ox-evnode__btn nodrag" onClick={() => openRecord(row.record.id)}>
        <span className="ox-evnode__kind">{KIND_LABEL[row.record.kind]}</span>
        <span className="ox-evnode__title">{row.record.title}</span>
        <span className="ox-evnode__meta">
          <StanceBadge stance={row.stance} />
          {row.record.isDemo && <span className="ox-evnode__demo">Demo</span>}
        </span>
      </button>
    </div>
  );
});

export const nodeTypes = { entity: EntityNode, zone: ZoneNode, evidence: EvidenceNode };
