"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

// ---------------------------------------------------------------------------
// Icons (inline, stroke-based, inherit currentColor)
// ---------------------------------------------------------------------------

const paths = {
  chevron: "M4 6l4 4 4-4",
  check: "M3.5 8.5l3 3 6-7",
  plus: "M8 3v10M3 8h10",
  minus: "M3 8h10",
  fit: "M2.5 6V2.5H6M10 2.5h3.5V6M13.5 10v3.5H10M6 13.5H2.5V10",
  map: "M1.5 3.5l4-1.5 5 1.5 4-1.5v10.5l-4 1.5-5-1.5-4 1.5z M5.5 2v10.5 M10.5 3.5V14",
  bundle: "M2 4c5 0 7 4 12 4M2 8h12M2 12c5 0 7-4 12-4",
  lines: "M2 3l12 10M2 8h12M2 13L14 3M2 5.5l12 5",
  close: "M4 4l8 8M12 4l-8 8",
  focus: "M2.5 5.5v-3h3M10.5 2.5h3v3M13.5 10.5v3h-3M5.5 13.5h-3v-3M8 6.2a1.8 1.8 0 1 0 0 3.6 1.8 1.8 0 0 0 0-3.6z",
  arrowLeft: "M13 8H3.5M7.5 4L3.5 8l4 4",
  arrowRight: "M3 8h9.5M8.5 4l4 4-4 4",
  arrowUp: "M8 13V3.5M4 7.5l4-4 4 4",
  arrowDown: "M8 3v9.5M4 8.5l4 4 4-4",
  chevronLeft: "M10 3.5L5.5 8l4.5 4.5",
  chevronRight: "M6 3.5L10.5 8 6 12.5",
  sort: "M5 3v10M2.5 10.5L5 13l2.5-2.5M11 13V3M8.5 5.5L11 3l2.5 2.5",
  graph: "M4 4.5a1.5 1.5 0 1 0 0 .01M12 3.5a1.5 1.5 0 1 0 0 .01M11 12.5a1.5 1.5 0 1 0 0 .01M5.4 4.2l5.1-.5M4.9 5.8l4.9 5.6M12 5v6",
  list: "M5.5 4h8M5.5 8h8M5.5 12h8M2.5 4h.01M2.5 8h.01M2.5 12h.01",
  keyboard: "M1.5 4.5h13v7h-13zM4 7h.01M6.5 7h.01M9 7h.01M11.5 7h.01M5 9.5h6",
  search: "M7 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM10.6 10.6L14 14",
  download: "M8 2.5v8M4.5 7.5L8 11l3.5-3.5M3 13.5h10",
  sun: "M8 5.2a2.8 2.8 0 1 0 0 5.6 2.8 2.8 0 0 0 0-5.6zM8 1.5v1.4M8 13.1v1.4M1.5 8h1.4M13.1 8h1.4M3.4 3.4l1 1M11.6 11.6l1 1M3.4 12.6l1-1M11.6 4.4l1-1",
  moon: "M13 9.6A5.5 5.5 0 0 1 6.4 3a5.5 5.5 0 1 0 6.6 6.6z",
  filter: "M2.5 3.5h11l-4.2 5v4l-2.6 1.5V8.5z",
  collapse: "M10 3.5L5.5 8l4.5 4.5",
  history: "M2.5 8a5.5 5.5 0 1 0 1.6-3.9M2.5 2.5v2.5H5 M8 5.2V8l2 1.4",
  route: "M2.5 12.5h3a2 2 0 0 0 2-2v-5a2 2 0 0 1 2-2h4M11 1.5l2.5 2-2.5 2",
} as const;

export type IconName = keyof typeof paths;

export function Icon({ name, size = 16 }: { name: IconName; size?: number }) {
  return (
    <svg className="ox-icon" width={size} height={size} viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path d={paths[name]} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Select: a themed listbox that replaces native <select>.
// The popover is portalled to <body> so scrolling panels never clip it.
// ---------------------------------------------------------------------------

export interface SelectOption<T extends string> {
  value: T;
  label: string;
  hint?: string;
  icon?: ReactNode;
}

interface SelectProps<T extends string> {
  label: string;
  hideLabel?: boolean;
  value: T;
  options: SelectOption<T>[];
  onChange: (value: T) => void;
  size?: "m" | "s";
  className?: string;
  title?: string;
}

const OPTION_H = 34;

export function Select<T extends string>({ label, hideLabel, value, options, onChange, size = "m", className, title }: SelectProps<T>) {
  const id = useId();
  const btnRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const typeahead = useRef({ text: "", at: 0 });
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [style, setStyle] = useState<CSSProperties>({});
  const selectedIndex = Math.max(0, options.findIndex((o) => o.value === value));
  const selected = options[selectedIndex];

  const openList = () => {
    const r = btnRef.current!.getBoundingClientRect();
    const height = Math.min(options.length * OPTION_H + 10, 320);
    const below = window.innerHeight - r.bottom;
    const up = below < height + 12 && r.top > below;
    const width = Math.max(r.width, 200);
    setStyle({
      position: "fixed",
      left: Math.max(8, Math.min(r.left, window.innerWidth - width - 8)),
      width,
      maxHeight: 320,
      ...(up ? { bottom: window.innerHeight - r.top + 6 } : { top: r.bottom + 6 }),
    });
    setActive(selectedIndex);
    setOpen(true);
  };

  const close = (refocus = true) => {
    setOpen(false);
    if (refocus) btnRef.current?.focus();
  };

  const choose = (i: number) => {
    const opt = options[i];
    if (opt) onChange(opt.value);
    close();
  };

  useEffect(() => {
    if (open) listRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector(`[data-i="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  useEffect(() => {
    if (!open) return;
    const inside = (t: EventTarget | null) => !!t && (listRef.current?.contains(t as Node) || btnRef.current?.contains(t as Node));
    const onDown = (e: PointerEvent) => {
      if (!inside(e.target)) setOpen(false);
    };
    const onScroll = (e: Event) => {
      if (!listRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onResize = () => setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [open]);

  const onButtonKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
      e.preventDefault();
      openList();
    }
  };

  const onListKey = (e: KeyboardEvent<HTMLUListElement>) => {
    const last = options.length - 1;
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActive((a) => Math.min(a + 1, last));
        break;
      case "ArrowUp":
        e.preventDefault();
        setActive((a) => Math.max(a - 1, 0));
        break;
      case "Home":
        e.preventDefault();
        setActive(0);
        break;
      case "End":
        e.preventDefault();
        setActive(last);
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        choose(active);
        break;
      case "Escape":
        e.preventDefault();
        e.stopPropagation();
        close();
        break;
      case "Tab":
        close(false);
        break;
      default:
        if (e.key.length === 1) {
          const now = e.timeStamp;
          const t = typeahead.current;
          t.text = now - t.at > 600 ? e.key.toLowerCase() : t.text + e.key.toLowerCase();
          t.at = now;
          const hit = options.findIndex((o) => o.label.toLowerCase().startsWith(t.text));
          if (hit >= 0) setActive(hit);
        }
    }
  };

  return (
    <div className={`ox-select ox-select--${size}${className ? ` ${className}` : ""}`}>
      <span id={`${id}-label`} className={hideLabel ? "sr-only" : "ox-select__label"}>
        {label}
      </span>
      <button
        ref={btnRef}
        type="button"
        className="ox-select__btn"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby={`${id}-label ${id}-value`}
        title={title}
        onClick={() => (open ? close() : openList())}
        onKeyDown={onButtonKey}
      >
        {selected?.icon}
        <span id={`${id}-value`} className="ox-select__value">
          {selected?.label ?? ""}
        </span>
        <Icon name="chevron" size={14} />
      </button>
      {open &&
        createPortal(
          <ul
            ref={listRef}
            role="listbox"
            tabIndex={-1}
            aria-labelledby={`${id}-label`}
            aria-activedescendant={`${id}-opt-${active}`}
            className="ox-select__list"
            style={style}
            onKeyDown={onListKey}
          >
            {options.map((o, i) => (
              <li
                key={o.value || "__empty"}
                id={`${id}-opt-${i}`}
                data-i={i}
                role="option"
                aria-selected={o.value === value}
                className={`ox-select__opt${i === active ? " is-active" : ""}${o.value === value ? " is-selected" : ""}`}
                onPointerMove={() => setActive(i)}
                onClick={() => choose(i)}
              >
                {o.icon}
                <span className="ox-select__opt-text">
                  {o.label}
                  {o.hint && <small>{o.hint}</small>}
                </span>
                {o.value === value && <Icon name="check" size={14} />}
              </li>
            ))}
          </ul>,
          document.body,
        )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Switch
// ---------------------------------------------------------------------------

export function Switch({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode }) {
  return (
    <button type="button" role="switch" aria-checked={checked} className="ox-switch" onClick={() => onChange(!checked)}>
      <span className="ox-switch__track" aria-hidden="true">
        <span className="ox-switch__thumb" />
      </span>
      <span className="ox-switch__label">{children}</span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Segmented control (radio group with roving focus)
// ---------------------------------------------------------------------------

interface SegmentedProps<T extends string> {
  label: string;
  value: T;
  options: Array<{ value: T; label: string; icon?: ReactNode; title?: string }>;
  onChange: (v: T) => void;
  size?: "m" | "s";
  className?: string;
}

export function Segmented<T extends string>({ label, value, options, onChange, size = "m", className }: SegmentedProps<T>) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = options.findIndex((o) => o.value === value);
    const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = (i + step + options.length) % options.length;
    onChange(options[next].value);
    refs.current[next]?.focus();
  };
  return (
    <div role="radiogroup" aria-label={label} className={`ox-seg ox-seg--${size}${className ? ` ${className}` : ""}`} onKeyDown={onKey}>
      {options.map((o, i) => (
        <button
          key={o.value}
          ref={(el) => {
            refs.current[i] = el;
          }}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          tabIndex={o.value === value ? 0 : -1}
          title={o.title}
          className="ox-seg__btn"
          onClick={() => onChange(o.value)}
        >
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Theme toggle: follows the system until the viewer picks a theme.
// ---------------------------------------------------------------------------

const THEME_KEY = "wayam-theme";
const themeListeners = new Set<() => void>();

function effectiveTheme(): "light" | "dark" {
  const set = document.documentElement.dataset.theme;
  if (set === "light" || set === "dark") return set;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function subscribeTheme(cb: () => void) {
  themeListeners.add(cb);
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener("change", cb);
  return () => {
    themeListeners.delete(cb);
    mq.removeEventListener("change", cb);
  };
}

/**
 * Apply and remember a theme. Like Chronos, the choice goes into a cookie so
 * the server can render the right theme in the very first HTML; localStorage
 * is a fallback for browsers that block cookies.
 */
function applyTheme(theme: "light" | "dark" | null) {
  const root = document.documentElement;
  if (theme) root.dataset.theme = theme;
  else delete root.dataset.theme;
  document.cookie = theme
    ? `${THEME_KEY}=${theme}; path=/; max-age=31536000; samesite=lax`
    : `${THEME_KEY}=; path=/; max-age=0; samesite=lax`;
  try {
    if (theme) window.localStorage.setItem(THEME_KEY, theme);
    else window.localStorage.removeItem(THEME_KEY);
  } catch {
    // The cookie (or this visit) still carries the choice.
  }
  themeListeners.forEach((l) => l());
}

/** Flip between light and dark, remembering the choice. */
export function toggleTheme() {
  applyTheme(effectiveTheme() === "dark" ? "light" : "dark");
}

/** Forget the explicit choice and follow the operating system again. */
export function followSystemTheme() {
  applyTheme(null);
}

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribeTheme, effectiveTheme, () => "light" as const);
  const next = theme === "dark" ? "light" : "dark";
  return (
    <button type="button" className="ox-theme" aria-label={`Switch to ${next} theme`} title={`Switch to ${next} theme`} onClick={toggleTheme}>
      <Icon name={theme === "dark" ? "sun" : "moon"} size={15} />
      <span className="ox-theme__label">{theme === "dark" ? "Light" : "Dark"}</span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Back button: one look for every "go back" in the app.
// ---------------------------------------------------------------------------

export function BackButton({ label, onClick, hint, className }: { label: string; onClick: () => void; hint?: string; className?: string }) {
  return (
    <button type="button" className={`ox-back${className ? ` ${className}` : ""}`} onClick={onClick}>
      <span className="ox-back__icon" aria-hidden="true">
        <Icon name="arrowLeft" size={15} />
      </span>
      <span className="ox-back__label">{label}</span>
      {hint && (
        <kbd className="ox-back__kbd" aria-hidden="true">
          {hint}
        </kbd>
      )}
    </button>
  );
}
