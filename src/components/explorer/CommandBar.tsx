"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { OntologyDataAdapter, SearchResult } from "@/lib/ontology/client";
import type { OntologyType, Page } from "@/lib/ontology/types";
import { Icon, type IconName } from "./controls";
import { useDebounced, useResource } from "./hooks";
import { EntityIcon } from "./EntityIcon";
import { familyVars } from "./ui";

export interface Command {
  id: string;
  label: string;
  /** Extra words that should match, e.g. "dark" for the theme toggle. */
  keywords?: string;
  shortcut?: string;
  /** Featured commands also appear as tiles when the box is empty. */
  icon?: IconName;
  hint?: string;
  run: () => void;
}

interface Props {
  open: boolean;
  adapter: OntologyDataAdapter;
  types: Map<string, OntologyType>;
  commands: Command[];
  onPickEntity: (id: string) => void;
  onClose: () => void;
}

type Item = { kind: "command"; cmd: Command } | { kind: "entity"; ent: SearchResult };

/**
 * Ctrl/⌘+K: jump to any entity or run any action without leaving the keyboard.
 * Commands match on label and keywords; entities come from the same search API
 * as the header box. Arrow keys move, Enter runs, Escape closes.
 */
export function CommandBar({ open, adapter, types, commands, onPickEntity, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const [text, setText] = useState("");
  const [active, setActive] = useState(0);
  const q = useDebounced(text.trim(), 120);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      d.showModal();
      inputRef.current?.focus();
    }
    if (!open && d.open) d.close();
  }, [open]);

  const matched = useMemo(() => {
    const t = text.trim().toLowerCase();
    if (!t) return commands;
    return commands.filter((c) => `${c.label} ${c.keywords ?? ""}`.toLowerCase().includes(t));
  }, [commands, text]);

  const res = useResource<Page<SearchResult>>(open && q ? `cmd-search:${q}` : null, (s) => adapter.search(q, { limit: 6 }, s));
  const entities = q && res.data ? res.data.items : [];

  // Entities first when the query looks like a name search; actions first otherwise.
  const items: Item[] = [
    ...(entities.length && matched.length < 3 ? entities.map((ent) => ({ kind: "entity" as const, ent })) : []),
    ...matched.map((cmd) => ({ kind: "command" as const, cmd })),
    ...(entities.length && matched.length >= 3 ? entities.map((ent) => ({ kind: "entity" as const, ent })) : []),
  ];
  const safeActive = Math.min(active, Math.max(items.length - 1, 0));

  const close = () => {
    setText("");
    setActive(0);
    onClose();
  };
  const run = (item: Item | undefined) => {
    if (!item) return;
    close();
    if (item.kind === "command") item.cmd.run();
    else onPickEntity(item.ent.id);
  };

  useEffect(() => {
    ref.current?.querySelector(`[data-i="${safeActive}"]`)?.scrollIntoView({ block: "nearest" });
  }, [safeActive]);

  let lastKind: Item["kind"] | null = null;
  return (
    <dialog ref={ref} className="ox-cmd" aria-label="Command bar" onClose={close} onClick={(e) => e.target === ref.current && close()}>
      <div className="ox-cmd__box">
        <div className="ox-cmd__field">
          <Icon name="search" />
          <input
            ref={inputRef}
            type="text"
            name="command"
            autoComplete="off"
            spellCheck={false}
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={items.length ? `${listId}-${safeActive}` : undefined}
            placeholder="Jump to an entity or run a command…"
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setActive(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((a) => Math.min(a + 1, items.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((a) => Math.max(a - 1, 0));
              } else if (e.key === "Enter") {
                e.preventDefault();
                run(items[safeActive]);
              }
            }}
          />
          <kbd>Esc</kbd>
        </div>
        {!text.trim() && (
          <div className="ox-cmd__launch" role="group" aria-label="Quick actions">
            {commands
              .filter((c) => c.icon)
              .slice(0, 6)
              .map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className="ox-launch"
                  onClick={() => {
                    close();
                    c.run();
                  }}
                >
                  <span className="ox-launch__icon" aria-hidden="true">
                    <Icon name={c.icon!} size={17} />
                  </span>
                  <span className="ox-launch__label">{c.label}</span>
                  {c.hint && <span className="ox-launch__hint">{c.hint}</span>}
                </button>
              ))}
          </div>
        )}
        <ul id={listId} role="listbox" className="ox-cmd__list" aria-label="Results">
          {items.length === 0 && (
            <li className="ox-cmd__empty">{res.loading ? "Searching…" : `Nothing matches “${text.trim()}”.`}</li>
          )}
          {items.map((item, i) => {
            const header =
              item.kind !== lastKind ? (
                <li className="ox-cmd__group" role="presentation" key={`h-${item.kind}-${i}`}>
                  {item.kind === "command" ? "Actions" : "Entities"}
                </li>
              ) : null;
            lastKind = item.kind;
            const t = item.kind === "entity" ? types.get(item.ent.typeId) : undefined;
            return [
              header,
              <li
                key={item.kind === "command" ? `c-${item.cmd.id}` : `e-${item.ent.id}`}
                id={`${listId}-${i}`}
                data-i={i}
                role="option"
                aria-selected={i === safeActive}
                className={`ox-cmd__item${i === safeActive ? " is-active" : ""}`}
                style={item.kind === "entity" ? familyVars(item.ent.family) : undefined}
                onPointerMove={() => setActive(i)}
                onClick={() => run(item)}
              >
                {item.kind === "command" ? (
                  <>
                    <span className="ox-cmd__label">{item.cmd.label}</span>
                    {item.cmd.shortcut && <kbd>{item.cmd.shortcut}</kbd>}
                  </>
                ) : (
                  <>
                    <EntityIcon id={item.ent.id} family={item.ent.family} glyph={t?.glyph ?? ""} size={18} className="ox-cmd__glyph" />
                    <span className="ox-cmd__label">{item.ent.label}</span>
                    <span className="ox-cmd__meta">{t?.label}</span>
                  </>
                )}
              </li>,
            ];
          })}
        </ul>
        <p className="ox-cmd__foot">
          <kbd>↑</kbd> <kbd>↓</kbd> to move, <kbd>Enter</kbd> to run
        </p>
      </div>
    </dialog>
  );
}
