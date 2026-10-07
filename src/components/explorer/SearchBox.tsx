"use client";

import { forwardRef, useId, useState } from "react";
import type { OntologyDataAdapter, SearchResult } from "@/lib/ontology/client";
import type { OntologyType, Page } from "@/lib/ontology/types";
import { useDebounced, useResource } from "./hooks";
import { EntityIcon } from "./EntityIcon";
import { familyVars } from "./ui";

interface Props {
  adapter: OntologyDataAdapter;
  types: Map<string, OntologyType>;
  onPick: (id: string) => void;
  placeholder?: string;
  showKbd?: boolean;
}

export const SearchBox = forwardRef<HTMLInputElement, Props>(function SearchBox({ adapter, types, onPick, placeholder = "Search entities, e.g. Vakyam…", showKbd = true }, ref) {
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const q = useDebounced(text.trim(), 180);
  const res = useResource<Page<SearchResult>>(q ? `search:${q}` : null, (s) => adapter.search(q, { limit: 8 }, s));
  const items = q ? (res.data?.items ?? []) : [];
  const listId = useId();
  const show = open && q.length > 0;

  const pick = (id: string) => {
    onPick(id);
    setOpen(false);
    setText("");
  };

  return (
    <div className="ox-search">
      <label className="sr-only" htmlFor={`${listId}-input`}>
        Search entities
      </label>
      <input
        ref={ref}
        id={`${listId}-input`}
        type="search"
        name="entity-search"
        autoComplete="off"
        spellCheck={false}
        role="combobox"
        aria-expanded={show}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={show && items[active] ? `${listId}-${items[active].id}` : undefined}
        placeholder={placeholder}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setOpen(true);
          setActive(0);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => Math.min(a + 1, items.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          } else if (e.key === "Enter" && items[active]) {
            e.preventDefault();
            pick(items[active].id);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
      />
      {showKbd && (
        <kbd className="ox-search__kbd" aria-hidden="true">
          /
        </kbd>
      )}
      {show && (
        <ul id={listId} role="listbox" className="ox-search__list" aria-label="Matching entities">
          {res.error && <li className="ox-search__empty">Search failed: {res.error.message} Check your connection and try again.</li>}
          {!res.error && items.length === 0 && (
            <li className="ox-search__empty">{res.loading ? "Searching…" : `No entity matches “${q}”.`}</li>
          )}
          {items.map((it, i) => {
            const t = types.get(it.typeId);
            return (
              <li
                key={it.id}
                id={`${listId}-${it.id}`}
                role="option"
                aria-selected={i === active}
                className={`ox-search__opt${i === active ? " is-active" : ""}`}
                style={familyVars(it.family)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(it.id)}
                onMouseEnter={() => setActive(i)}
              >
                <EntityIcon id={it.id} family={it.family} glyph={t?.glyph ?? ""} size={18} className="ox-search__glyph" />
                <span className="ox-search__label">
                  {it.label}
                  {it.matched && <span className="ox-search__alias"> matches “{it.matched}”</span>}
                </span>
                <span className="ox-search__type">{t?.label}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
});
