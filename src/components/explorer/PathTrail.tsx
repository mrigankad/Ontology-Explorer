"use client";

import { Fragment } from "react";
import { edgeBetween, type GraphData } from "@/lib/ontology/graph-model";
import type { EdgeSummary } from "@/lib/ontology/types";
import { Icon } from "./controls";
import { STATE_META } from "./ui";

interface Props {
  graph: GraphData;
  path: string[];
  selectedNode: string | null;
  edge: EdgeSummary | null;
  evidenceOpen: boolean;
  recordId: string | null;
  onEntity: (id: string) => void;
  onEdge: (id: string) => void;
  onEvidence: () => void;
  onExport: () => void;
  exporting: boolean;
}

/**
 * The exact hops from the root to the current focus. Each hop is clickable;
 * going back keeps all filters because only selection/path change.
 */
export function PathTrail({ graph, path, selectedNode, edge, evidenceOpen, recordId, onEntity, onEdge, onEvidence, onExport, exporting }: Props) {
  const label = (id: string) => graph.nodes.get(id)?.label ?? id;
  const showEdgeTail = edge && path[path.length - 1] === edge.subjectId;
  return (
    <nav className="ox-trail" aria-label="Traversal path">
      <ol className="ox-trail__list">
        {path.length === 0 && <li className="ox-trail__hint">Select an entity to start a path. Every hop you take is recorded here.</li>}
        {path.map((id, i) => {
          const hop = i > 0 ? edgeBetween(graph, path[i - 1], id) : null;
          const reversed = hop && hop.subjectId === id;
          const current = id === selectedNode && !edge && !evidenceOpen;
          return (
            <Fragment key={`${id}-${i}`}>
              {hop && (
                <li className="ox-trail__hop">
                  <button type="button" className="ox-trail__pred" onClick={() => onEdge(hop.id)} title={STATE_META[hop.evidenceState].label}>
                    {reversed && <Icon name="arrowLeft" size={13} />}
                    {hop.label}
                    {!reversed && <Icon name="arrowRight" size={13} />}
                    <span className="sr-only">
                      {reversed ? " (inbound)" : ""}, {STATE_META[hop.evidenceState].label}
                    </span>
                  </button>
                </li>
              )}
              <li>
                <button
                  type="button"
                  className={`ox-trail__node${current ? " is-current" : ""}`}
                  aria-current={current ? "location" : undefined}
                  onClick={() => onEntity(id)}
                >
                  {label(id)}
                </button>
              </li>
            </Fragment>
          );
        })}
        {edge && (
          <>
            <li className="ox-trail__hop">
              <button
                type="button"
                className={`ox-trail__pred is-claim${!evidenceOpen ? " is-current" : ""}`}
                onClick={() => onEdge(edge.id)}
                aria-current={!evidenceOpen ? "location" : undefined}
              >
                {showEdgeTail ? edge.label : `${label(edge.subjectId)} ${edge.label}`}
                <Icon name="arrowRight" size={13} />
              </button>
            </li>
            <li>
              <button type="button" className="ox-trail__node" onClick={() => onEntity(edge.objectId)}>
                {label(edge.objectId)}
              </button>
            </li>
          </>
        )}
        {evidenceOpen && (
          <li className="ox-trail__end">
            <button type="button" className={`ox-trail__ev${!recordId ? " is-current" : ""}`} onClick={onEvidence}>
              Evidence records
            </button>
          </li>
        )}
        {recordId && (
          <li className="ox-trail__end">
            <span className="ox-trail__ev is-current" aria-current="location">
              {recordId}
            </span>
          </li>
        )}
      </ol>
      {path.length > 1 && (
        <button type="button" className="ox-trail__export" onClick={onExport} disabled={exporting} title="Download this trail and its evidence as a Markdown report">
          <Icon name="download" size={14} />
          {exporting ? "Preparing…" : "Export trail"}
        </button>
      )}
    </nav>
  );
}
