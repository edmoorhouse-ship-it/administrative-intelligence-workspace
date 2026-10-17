"use client";

import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";

interface MenuProps {
  anchor: HTMLElement | null;
  onClose: () => void;
  align?: "start" | "end";
  width?: number;
  children: ReactNode;
}

/** Popover anchored to an element, rendered in a portal so scroll containers can't clip it. */
export function Menu({ anchor, onClose, align = "start", width = 220, children }: MenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!anchor) return;
    const onPointer = (e: MouseEvent) => {
      const target = e.target as Node;
      if (ref.current?.contains(target) || anchor.contains(target)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    // Close only when something holding the anchor scrolls (the menu would detach),
    // not when an unrelated pane such as the streaming message list scrolls.
    const onScroll = (e: Event) => {
      const target = e.target;
      if (target instanceof Node && target.contains(anchor)) onClose();
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onClose);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onClose);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [anchor, onClose]);

  if (!anchor) return null;

  const rect = anchor.getBoundingClientRect();
  const opensUp = rect.top > window.innerHeight * 0.6;
  const left = Math.min(
    Math.max(8, align === "start" ? rect.left : rect.right - width),
    window.innerWidth - width - 8,
  );
  const style: CSSProperties = {
    position: "fixed",
    left,
    width,
    boxShadow: "var(--menu-shadow)",
    ...(opensUp ? { bottom: window.innerHeight - rect.top + 6 } : { top: rect.bottom + 6 }),
  };

  return createPortal(
    <div
      ref={ref}
      role="menu"
      style={style}
      className="anim-pop-in z-50 max-h-[70vh] overflow-y-auto rounded-xl bg-surface p-1.5 text-sm text-fg"
    >
      {children}
    </div>,
    document.body,
  );
}

interface MenuItemProps {
  icon?: ReactNode;
  children: ReactNode;
  onSelect: () => void;
  danger?: boolean;
  trailing?: ReactNode;
}

export function MenuItem({ icon, children, onSelect, danger, trailing }: MenuItemProps) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onSelect}
      className={`flex min-h-8 w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-hover ${danger ? "text-danger" : "text-fg"}`}
    >
      {icon && <span className={`flex size-4 shrink-0 items-center justify-center ${danger ? "" : "text-secondary"}`}>{icon}</span>}
      <span className="min-w-0 flex-1">{children}</span>
      {trailing}
    </button>
  );
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return <p className="px-2 pb-1 pt-1.5 text-xs text-muted">{children}</p>;
}

export function MenuDivider() {
  return <div className="mx-1 my-1.5 h-px bg-line" />;
}
