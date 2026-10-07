"use client";

import { useEffect, useRef, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";

export type MenuAction = "inspect" | "expand" | "isolate" | "evidence" | "path" | "hide" | "copy";

const ITEMS: Array<{ action: MenuAction; label: string; hint?: string }> = [
  { action: "inspect", label: "Inspect details", hint: "Enter" },
  { action: "expand", label: "Expand neighbours", hint: "+" },
  { action: "isolate", label: "Show only this and its links" },
  { action: "evidence", label: "View evidence" },
  { action: "path", label: "Find a path to…" },
  { action: "copy", label: "Copy link to this entity" },
  { action: "hide", label: "Hide from canvas" },
];

interface Props {
  x: number;
  y: number;
  title: string;
  onAction: (a: MenuAction) => void;
  onClose: () => void;
}

/**
 * Context menu for a canvas entity (right-click, the Menu key, or Shift+F10).
 * Follows the ARIA menu pattern: arrow keys move, Enter activates, Escape
 * closes and returns focus to where it was.
 */
export function NodeMenu({ x, y, title, onAction, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const returnTo = useRef<Element | null>(null);

  useEffect(() => {
    returnTo.current = document.activeElement;
    ref.current?.querySelector<HTMLButtonElement>("[role=menuitem]")?.focus();
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    const onScroll = () => onClose();
    document.addEventListener("pointerdown", onDown);
    window.addEventListener("resize", onScroll);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      window.removeEventListener("resize", onScroll);
      (returnTo.current as HTMLElement | null)?.focus?.();
    };
  }, [onClose]);

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const items = [...(ref.current?.querySelectorAll<HTMLButtonElement>("[role=menuitem]") ?? [])];
    const i = items.indexOf(document.activeElement as HTMLButtonElement);
    const go = (n: number) => items[(n + items.length) % items.length]?.focus();
    if (e.key === "ArrowDown") go(i + 1);
    else if (e.key === "ArrowUp") go(i - 1);
    else if (e.key === "Home") go(0);
    else if (e.key === "End") go(items.length - 1);
    else if (e.key === "Escape" || e.key === "Tab") onClose();
    else return;
    e.preventDefault();
    e.stopPropagation();
  };

  // Keep the menu on screen.
  const left = Math.min(x, window.innerWidth - 248);
  const top = Math.min(y, window.innerHeight - ITEMS.length * 36 - 56);

  return createPortal(
    <div ref={ref} className="ox-menu" role="menu" aria-label={`Actions for ${title}`} style={{ left, top }} onKeyDown={onKey}>
      <p className="ox-menu__title">{title}</p>
      {ITEMS.map((it) => (
        <button
          key={it.action}
          type="button"
          role="menuitem"
          tabIndex={-1}
          className={`ox-menu__item${it.action === "hide" ? " is-quiet" : ""}`}
          onClick={() => {
            onAction(it.action);
            onClose();
          }}
        >
          {it.label}
          {it.hint && <kbd>{it.hint}</kbd>}
        </button>
      ))}
    </div>,
    document.body,
  );
}
