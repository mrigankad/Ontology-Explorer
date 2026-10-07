"use client";

import { useEffect, useRef, useState } from "react";
import type { OntologyDataAdapter } from "@/lib/ontology/client";
import type { EntitySummary, OntologyType } from "@/lib/ontology/types";
import { Icon, Select } from "./controls";
import { SearchBox } from "./SearchBox";

// ---------------------------------------------------------------------------
// Path finder: "how is A connected to B?"
// ---------------------------------------------------------------------------

interface PathFinderProps {
  adapter: OntologyDataAdapter;
  types: Map<string, OntologyType>;
  nodes: EntitySummary[];
  from: string;
  busy: boolean;
  error: string | null;
  onFrom: (id: string) => void;
  onFind: (to: string) => void;
  onClose: () => void;
}

export function PathFinder({ adapter, types, nodes, from, busy, error, onFrom, onFind, onClose }: PathFinderProps) {
  const toRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    toRef.current?.focus();
  }, []);
  const options = [...nodes].sort((a, b) => a.label.localeCompare(b.label)).map((n) => ({ value: n.id, label: n.label, hint: types.get(n.typeId)?.label }));
  return (
    <section className="ox-float ox-pathfinder" aria-labelledby="ox-pf-title" onKeyDown={(e) => e.key === "Escape" && (e.stopPropagation(), onClose())}>
      <header className="ox-float__head">
        <h2 id="ox-pf-title" className="ox-float__title">
          Find a path
        </h2>
        <button type="button" className="ox-icon-btn" onClick={onClose} aria-label="Close path finder">
          <Icon name="close" />
        </button>
      </header>
      <p className="ox-small ox-muted">The shortest chain of relationships between two entities, in either direction.</p>
      <div className="ox-pf-tiles">
        <div className="ox-pf-tile">
          <Select label="From" className="ox-field" value={from} onChange={onFrom} options={options} />
        </div>
        <span className="ox-pf-arrow" aria-hidden="true">
          <Icon name="arrowDown" size={16} />
        </span>
        <div className="ox-pf-tile">
          <div className="ox-field">
            <span>To</span>
            <SearchBox ref={toRef} adapter={adapter} types={types} onPick={onFind} placeholder="Search for the other entity…" showKbd={false} />
          </div>
        </div>
      </div>
      {busy && (
        <p className="ox-small" role="status">
          Looking for a connection…
        </p>
      )}
      {error && (
        <p className="ox-inline-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Shortcuts + how-to dialog
// ---------------------------------------------------------------------------

const SHORTCUTS: Array<[string, string]> = [
  ["Ctrl + K", "Command bar: jump to an entity or run any action"],
  ["/", "Search entities"],
  ["?", "Open this help"],
  ["Esc", "Close the record, then the evidence table, then clear the selection"],
  ["Tab", "Move between entities on the canvas"],
  ["Enter", "Inspect the focused entity or link"],
  ["+", "Expand the focused entity’s neighbours"],
  ["Shift + F10", "Open the actions menu for the focused entity"],
  ["← / →", "Previous or next record in the record viewer"],
  ["Arrow keys", "Move to the nearest entity in that direction"],
  ["Shift + arrows", "Move the focused entity"],
  ["F", "Frame the selection"],
];

const GESTURES: Array<[string, string]> = [
  ["Click a band’s number", "Show each link between those two families"],
  ["Click an entity", "Inspect it and highlight its links"],
  ["Double-click an entity", "Load its neighbours"],
  ["Right-click an entity", "Expand, isolate, find a path, hide and more"],
  ["Click a +N badge", "Load links that aren’t on the canvas yet"],
  ["Scroll or pinch", "Zoom; drag the background to pan"],
];

export function HelpDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className="ox-dialog"
      aria-labelledby="ox-help-title"
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
    >
      <div className="ox-dialog__body">
        <header className="ox-dialog__head">
          <div>
            <h2 id="ox-help-title" className="ox-dialog__title">
              Getting around
            </h2>
            <p className="ox-small ox-muted">Everything you can do with a mouse or keyboard.</p>
          </div>
          <button type="button" className="ox-icon-btn" onClick={onClose} aria-label="Close help">
            <Icon name="close" />
          </button>
        </header>
        <div className="ox-bento ox-help-bento">
          <section className="ox-tile ox-tile--feature" aria-labelledby="ox-help-k">
            <span className="ox-feature__icon" aria-hidden="true">
              <Icon name="search" size={18} />
            </span>
            <h3 className="ox-feature__title" id="ox-help-k">
              <kbd>Ctrl</kbd> <kbd>K</kbd>
            </h3>
            <p>Jump to any entity or run any action from one box.</p>
          </section>

          <section className="ox-tile ox-tile--legend" aria-labelledby="ox-help-lines">
            <header className="ox-tile__head">
              <h3 className="ox-tile__label" id="ox-help-lines">
                Reading lines
              </h3>
            </header>
            <ul className="ox-linekey">
              <li>
                <svg width="44" height="10" aria-hidden="true">
                  <line x1="2" y1="5" x2="42" y2="5" className="ox-legend__line ox-edge--linked" />
                </svg>
                Evidence linked, not yet reviewed
              </li>
              <li>
                <svg width="44" height="10" aria-hidden="true">
                  <line x1="2" y1="5" x2="42" y2="5" className="ox-legend__line ox-edge--none" />
                </svg>
                No evidence yet, so unverified
              </li>
              <li>
                <svg width="44" height="10" aria-hidden="true">
                  <line x1="2" y1="5" x2="42" y2="5" className="ox-legend__line ox-edge--disputed" />
                </svg>
                Disputed by a record
              </li>
              <li>
                <span className="ox-legend__band" aria-hidden="true" />
                Band: all links between two families
              </li>
            </ul>
          </section>

          <section className="ox-tile ox-tile--mouse" aria-labelledby="ox-help-mouse">
            <header className="ox-tile__head">
              <h3 className="ox-tile__label" id="ox-help-mouse">
                Mouse
              </h3>
            </header>
            <dl className="ox-keys">
              {GESTURES.map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="ox-tile ox-tile--keys" aria-labelledby="ox-help-keys">
            <header className="ox-tile__head">
              <h3 className="ox-tile__label" id="ox-help-keys">
                Keyboard
              </h3>
            </header>
            <dl className="ox-keys">
              {SHORTCUTS.filter(([k]) => k !== "Ctrl + K").map(([k, v]) => (
                <div key={k}>
                  <dt>
                    <kbd>{k}</kbd>
                  </dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
          </section>
        </div>
      </div>
    </dialog>
  );
}

// ---------------------------------------------------------------------------
// First-run tip
// ---------------------------------------------------------------------------

const TIP_KEY = "wayam-explorer-tip-v1";

export function FirstRunTip({ onHelp }: { onHelp: () => void }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    let seen = true;
    try {
      seen = window.localStorage.getItem(TIP_KEY) === "1";
    } catch {
      seen = true;
    }
    if (seen) return;
    const t = setTimeout(() => setShow(true), 400);
    return () => clearTimeout(t);
  }, []);
  if (!show) return null;
  const dismiss = () => {
    setShow(false);
    try {
      window.localStorage.setItem(TIP_KEY, "1");
    } catch {
      // Storage can be unavailable (private mode); the tip just shows again next time.
    }
  };
  return (
    <aside className="ox-float ox-tip" aria-label="Tip">
      <p className="ox-tip__title">Reading the map</p>
      <p>
        Coloured bands group the links between two families. Click a band&rsquo;s number to see each link, or click an entity to see
        only its own links. Right-click an entity for more actions.
      </p>
      <div className="ox-btnrow">
        <button type="button" className="ox-btn ox-btn--primary ox-btn--small" onClick={dismiss}>
          Got it
        </button>
        <button
          type="button"
          className="ox-btn ox-btn--quiet ox-btn--small"
          onClick={() => {
            dismiss();
            onHelp();
          }}
        >
          All shortcuts
        </button>
      </div>
    </aside>
  );
}
