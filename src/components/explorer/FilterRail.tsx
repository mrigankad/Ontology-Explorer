"use client";

import type { GraphData } from "@/lib/ontology/graph-model";
import type { EvidenceState, FamilyId, OntologyType, RelationType } from "@/lib/ontology/types";
import type { ExplorerUrlState } from "@/lib/ontology/url-state";
import { Icon, Select, Switch } from "./controls";
import { STATE_META, familyVars } from "./ui";

interface Props {
  state: ExplorerUrlState;
  graph: GraphData;
  rootId: string;
  types: OntologyType[];
  relationTypes: RelationType[];
  familyTotals: Record<string, number>;
  shown: { nodes: number; edges: number; hiddenNodes: number; hiddenEdges: number };
  unloaded: number;
  onChange: (patch: Partial<ExplorerUrlState>) => void;
  onReset: () => void;
  onCollapse: () => void;
}

const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

export function FilterRail({ state, graph, rootId, types, relationTypes, familyTotals, shown, unloaded, onChange, onReset, onCollapse }: Props) {
  const loadedByFamily = new Map<FamilyId, number>();
  for (const n of graph.nodes.values()) loadedByFamily.set(n.family, (loadedByFamily.get(n.family) ?? 0) + 1);
  const presentRelations = new Set([...graph.edges.values()].map((e) => e.relationTypeId));
  const stateCounts = new Map<EvidenceState, number>();
  for (const e of graph.edges.values()) stateCounts.set(e.evidenceState, (stateCounts.get(e.evidenceState) ?? 0) + 1);
  const products = [...graph.nodes.values()].filter((n) => n.family === "product").sort((a, b) => a.label.localeCompare(b.label));
  const industries = [...graph.nodes.values()].filter((n) => n.family === "industry").sort((a, b) => a.label.localeCompare(b.label));
  const families = types.filter((t) => t.family !== "company" && (loadedByFamily.has(t.family) || familyTotals[t.family]));
  const anyFilter =
    state.hideFamilies.length || state.rels.length || state.states.length || state.focus || state.isolate || state.evidenceNodes;

  return (
    <aside className="ox-rail" aria-label="Filters">
      <div className="ox-rail__head">
        <h2 className="ox-rail__title">Filters</h2>
        <button type="button" className="ox-icon-btn ox-rail__collapse" onClick={onCollapse} aria-label="Hide the filter panel" title="Hide filters">
          <Icon name="collapse" />
        </button>
      </div>
      <div className="ox-rail__summary" role="status">
        <p>
          <strong>{shown.nodes}</strong> entities and <strong>{shown.edges}</strong> links shown
        </p>
        {(shown.hiddenNodes > 0 || shown.hiddenEdges > 0) && (
          <p className="ox-rail__hidden">
            {shown.hiddenNodes} entities and {shown.hiddenEdges} links hidden by filters
          </p>
        )}
        {unloaded > 0 && <p className="ox-muted ox-small">{unloaded} more entities load when you expand a node.</p>}
        {anyFilter ? (
          <button type="button" className="ox-btn ox-btn--quiet ox-btn--small" onClick={onReset}>
            Reset filters
          </button>
        ) : null}
      </div>

      <fieldset className="ox-fieldset">
        <legend>Families</legend>
        {families.map((t) => {
          const checked = !state.hideFamilies.includes(t.family);
          return (
            <label key={t.id} className="ox-check" style={familyVars(t.family)}>
              <input type="checkbox" checked={checked} onChange={() => onChange({ hideFamilies: toggle(state.hideFamilies, t.family) })} />
              <span className="ox-check__swatch" aria-hidden="true">
                {t.glyph}
              </span>
              <span className="ox-check__label">{t.pluralLabel}</span>
              <span className="ox-check__count">
                {loadedByFamily.get(t.family) ?? 0}
                {familyTotals[t.family] && familyTotals[t.family] !== loadedByFamily.get(t.family) ? `/${familyTotals[t.family]}` : ""}
              </span>
            </label>
          );
        })}
      </fieldset>

      <fieldset className="ox-fieldset">
        <legend>Evidence</legend>
        {(["linked", "none", "disputed", "verified"] as EvidenceState[]).map((s) => (
          <label key={s} className="ox-check">
            <input type="checkbox" checked={state.states.includes(s)} onChange={() => onChange({ states: toggle(state.states, s) })} />
            <span className={`ox-check__swatch ox-sw--${s}`} aria-hidden="true">
              {STATE_META[s].glyph}
            </span>
            <span className="ox-check__label">{STATE_META[s].label}</span>
            <span className="ox-check__count">{stateCounts.get(s) ?? 0}</span>
          </label>
        ))}
        <p className="ox-muted ox-small">Tick any to show only links in those states.</p>
      </fieldset>

      <fieldset className="ox-fieldset">
        <legend>Focus</legend>
        <Select
          label="Product"
          className="ox-field"
          value={products.some((p) => p.id === state.focus) ? state.focus! : ""}
          onChange={(v) => onChange({ focus: v || null })}
          options={[{ value: "", label: "Any product" }, ...products.map((p) => ({ value: p.id, label: p.label }))]}
        />
        <Select
          label="Industry"
          className="ox-field"
          value={industries.some((p) => p.id === state.focus) ? state.focus! : ""}
          onChange={(v) => onChange({ focus: v || null })}
          options={[{ value: "", label: "Any industry" }, ...industries.map((p) => ({ value: p.id, label: p.label }))]}
        />
        {state.focus && state.focus !== rootId && (
          <p className="ox-muted ox-small">Showing entities within two links of {graph.nodes.get(state.focus)?.label}.</p>
        )}
      </fieldset>

      <fieldset className="ox-fieldset">
        <legend>Relations</legend>
        {relationTypes
          .filter((r) => presentRelations.has(r.id))
          .map((r) => (
            <label key={r.id} className="ox-check">
              <input type="checkbox" checked={state.rels.includes(r.id)} onChange={() => onChange({ rels: toggle(state.rels, r.id) })} />
              <span className="ox-check__label">{r.label}</span>
            </label>
          ))}
        <p className="ox-muted ox-small">Tick any to show only those relations.</p>
      </fieldset>

      <fieldset className="ox-fieldset">
        <legend>Canvas</legend>
        <Switch checked={state.evidenceNodes} onChange={(v) => onChange({ evidenceNodes: v })}>
          Show evidence around the selection
        </Switch>
      </fieldset>
    </aside>
  );
}
