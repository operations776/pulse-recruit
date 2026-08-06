"use client";

import { useEffect, useRef, type ReactNode } from "react";

// PLS-104. A small anchored popover for the top bar.
//
// Deliberately NOT the Dialog from overlay.tsx. A dialog is modal: it takes a
// scrim, traps focus, and makes everything behind it inert. That is right for
// "write a post" and wrong for "what is my unread count", which should close
// the moment you look somewhere else.
//
// The three top-bar menus (settings, alerts, workspace) share this so the
// dismiss behaviour cannot drift between them: outside click closes, Escape
// closes and returns focus to the trigger.

export function Popover({
  open,
  onClose,
  label,
  align = "right",
  width = 214,
  children,
}: {
  open: boolean;
  onClose: () => void;
  /** Names the menu for screen readers. */
  label: string;
  align?: "left" | "right";
  width?: number;
  children: ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
      }
    };

    // pointerdown, not click: a click fires after mouseup, so a control under
    // the popover would receive the same gesture that dismissed it.
    const onPointer = (event: PointerEvent) => {
      const node = panel.current;
      if (!node) return;
      const target = event.target as Node;
      // The trigger handles its own toggle. Closing here as well would make a
      // click on it close and immediately reopen.
      if (node.contains(target) || node.parentElement?.contains(target)) return;
      onClose();
    };

    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={panel}
      role="menu"
      aria-label={label}
      style={{ width }}
      className={`floating layer-rise absolute top-[calc(100%+8px)] z-50 rounded-shell border border-rule p-4 text-ink ${
        align === "right" ? "right-0" : "left-0"
      }`}
    >
      {children}
    </div>
  );
}

/** The mono heading every top-bar menu opens with. */
export function PopoverTitle({ children }: { children: ReactNode }) {
  return <p className="legend mb-3 text-ink-3">{children}</p>;
}
