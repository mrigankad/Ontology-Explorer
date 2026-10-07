"use client";

import type { GraphData } from "@/lib/ontology/graph-model";
import { FAMILY_ORDER } from "@/lib/ontology/graph-model";
import type { OntologyType, RelationType } from "@/lib/ontology/types";
import { EvidenceSummary, IdText, StateBadge, familyVars, totalEvidence } from "./ui";

interface ListProps {
  graph: GraphData;
  nodeIds: Set<string>;
  edgeIds: Set<string>;
  types: Map<string, OntologyType>;
  selectedNode: string | null;
  selectedEdge: string | null;
  onNode: (id: string) => void;
  onEdge: (id: string) => void;
}

/** Structured alternative to the canvas: same data, same filters, native table navigation. */
export function ListView({ graph, nodeIds, edgeIds, types, selectedNode, selectedEdge, onNode, onEdge }: ListProps) {
  const nodes = [...graph.nodes.values()].filter((n) => nodeIds.has(n.id));
  const order = ["company", ...FAMILY_ORDER];
  nodes.sort((a, b) => order.indexOf(a.family) - order.indexOf(b.family) || a.label.localeCompare(b.label));
  const edges = [...graph.edges.values()].filter((e) => edgeIds.has(e.id));
  const label = (id: string) => graph.nodes.get(id)?.label ?? id;

  return (
    <div className="ox-listview">
      <section aria-labelledby="ox-list-entities">
        <h2 id="ox-list-entities" className="ox-listview__h">
          Entities <span className="ox-count">{nodes.length}</span>
        </h2>
        <div className="ox-tablewrap">
          <table className="ox-table">
            <thead>
              <tr>
                <th scope="col">Entity</th>
                <th scope="col">Class</th>
                <th scope="col">Links</th>
                <th scope="col">Evidence</th>
                <th scope="col">ID</th>
              </tr>
            </thead>
            <tbody>
              {nodes.map((n) => {
                const t = types.get(n.typeId);
                return (
                  <tr key={n.id} className={n.id === selectedNode ? "is-active" : undefined}>
                    <td>
                      <button type="button" className="ox-rowlink" style={familyVars(n.family)} onClick={() => onNode(n.id)}>
                        <span aria-hidden="true" className="ox-rowlink__glyph">
                          {t?.glyph}
                        </span>{" "}
                        {n.label}
                      </button>
                    </td>
                    <td>{t?.label}</td>
                    <td>{n.degree}</td>
                    <td>{totalEvidence(n.evidence) ? <EvidenceSummary counts={n.evidence} /> : <span className="ox-muted">None linked</span>}</td>
                    <td>
                      <IdText>{n.id}</IdText>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="ox-list-rels">
        <h2 id="ox-list-rels" className="ox-listview__h">
          Relationships <span className="ox-count">{edges.length}</span>
        </h2>
        <div className="ox-tablewrap">
          <table className="ox-table">
            <thead>
              <tr>
                <th scope="col">Subject</th>
                <th scope="col">Predicate</th>
                <th scope="col">Object</th>
                <th scope="col">Evidence state</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {edges.map((e) => (
                <tr key={e.id} className={e.id === selectedEdge ? "is-active" : undefined}>
                  <td>{label(e.subjectId)}</td>
                  <td>
                    <button type="button" className="ox-rowlink" onClick={() => onEdge(e.id)}>
                      {e.label}
                      <span className="sr-only">
                        {" "}
                        relationship between {label(e.subjectId)} and {label(e.objectId)}
                      </span>
                    </button>
                  </td>
                  <td>{label(e.objectId)}</td>
                  <td>
                    <StateBadge state={e.evidenceState} />
                  </td>
                  <td>{e.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export function SchemaView({ types, relationTypes }: { types: OntologyType[]; relationTypes: RelationType[] }) {
  const typeLabel = (id: string) => types.find((t) => t.id === id)?.label ?? id;
  return (
    <div className="ox-listview">
      <p className="ox-note">
        This is the ontology schema: the classes and predicates every instance must follow. Relationship direction and allowed
        subject/object classes are validated on import.
      </p>
      <section aria-labelledby="ox-schema-types">
        <h2 id="ox-schema-types" className="ox-listview__h">
          Classes <span className="ox-count">{types.length}</span>
        </h2>
        <div className="ox-tablewrap">
          <table className="ox-table">
            <thead>
              <tr>
                <th scope="col">Class</th>
                <th scope="col">Family</th>
                <th scope="col">Meaning</th>
                <th scope="col">ID</th>
              </tr>
            </thead>
            <tbody>
              {types.map((t) => (
                <tr key={t.id}>
                  <td>
                    <span className="ox-type" style={familyVars(t.family)}>
                      <span aria-hidden="true">{t.glyph}</span> {t.label}
                    </span>
                  </td>
                  <td>{t.pluralLabel}</td>
                  <td>{t.description}</td>
                  <td>
                    <IdText>{t.id}</IdText>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section aria-labelledby="ox-schema-rels">
        <h2 id="ox-schema-rels" className="ox-listview__h">
          Predicates <span className="ox-count">{relationTypes.length}</span>
        </h2>
        <div className="ox-tablewrap">
          <table className="ox-table">
            <thead>
              <tr>
                <th scope="col">Predicate</th>
                <th scope="col">Subject classes</th>
                <th scope="col">Object classes</th>
                <th scope="col">Inverse reading</th>
                <th scope="col">Meaning</th>
              </tr>
            </thead>
            <tbody>
              {relationTypes.map((r) => (
                <tr key={r.id}>
                  <td>
                    <strong>{r.label}</strong> <IdText>{r.id}</IdText>
                  </td>
                  <td>{r.subjectTypes.map(typeLabel).join(", ")}</td>
                  <td>{r.objectTypes.map(typeLabel).join(", ")}</td>
                  <td>{r.inverseLabel ?? "—"}</td>
                  <td>{r.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
