"use client";

import { X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";

// DESIGN.md: Esc closes the topmost layer. Both layers share this hook so the
// behaviour cannot drift between them.
function useEscape(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);
}

/**
 * Toasts persist until dismissed and live in the bottom right corner, which is
 * where a layer's own controls sit. Marking the body lets globals.css move the
 * stack aside for as long as the layer is open, so a couple of unread toasts
 * cannot make the buttons underneath them unclickable.
 *
 * This started life inside Drawer. The wide dialog has the same footer in the
 * same corner, so it belongs to both.
 */
function useLayerMark(open: boolean) {
  useEffect(() => {
    if (!open) return;
    document.body.dataset.layer = "drawer";
    return () => {
      delete document.body.dataset.layer;
    };
  }, [open]);
}

/**
 * Keep Tab inside the layer while it is open.
 *
 * Without this, tabbing out of a modal lands on the page behind the scrim:
 * focus goes somewhere the user cannot see, and Enter then fires a control
 * they did not mean to press. Everything below the top layer is inert to the
 * pointer already; this makes it inert to the keyboard too.
 */
function useFocusTrap(open: boolean, ref: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!open) return;
    const node = ref.current;
    if (!node) return;

    const selector =
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

    // Focus the first control so the keyboard starts inside the layer rather
    // than wherever it happened to be on the page behind.
    const first = node.querySelector<HTMLElement>(selector);
    first?.focus();

    const handler = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const focusable = Array.from(
        node.querySelectorAll<HTMLElement>(selector),
      ).filter((el) => el.offsetParent !== null);
      if (focusable.length === 0) return;

      const start = focusable[0];
      const end = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === start) {
        event.preventDefault();
        end.focus();
      } else if (!event.shiftKey && document.activeElement === end) {
        event.preventDefault();
        start.focus();
      }
    };

    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, ref]);
}

// A fixed scale, like every other size in this system. `wide` exists for a
// layer that holds a long-form post: a LinkedIn draft in a 460px column is a
// scrollbar with a paragraph in it.
const DIALOG_WIDTH = {
  default: "max-w-[460px]",
  wide: "max-w-[900px]",
} as const;

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "default",
  headerRight,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: keyof typeof DIALOG_WIDTH;
  /** Chips or metadata that belong beside the title, left of the close button. */
  headerRight?: ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);
  useEscape(open, onClose);
  useLayerMark(open);
  useFocusTrap(open, panel);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        aria-label="Close dialog"
        className="scrim absolute inset-0"
        onClick={onClose}
      />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        // max-h plus a flex column so a tall dialog scrolls its body rather
        // than growing past the viewport and stranding its own footer.
        className={`floating relative flex max-h-[calc(100vh-2rem)] w-full flex-col rounded-shell ${DIALOG_WIDTH[size]}`}
      >
        <div className="flex items-start justify-between gap-4 px-5 pb-3 pt-5">
          <div className="min-w-0">
            <h2 className="display text-[18px] font-semibold leading-6">
              {title}
            </h2>
            {description ? (
              <p className="mt-1 text-[12px] text-ink-2">{description}</p>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-3">
            {headerRight}
            <button
              onClick={onClose}
              aria-label="Close"
              className="rounded-control p-1 text-ink-3 hover:bg-paper hover:text-ink"
            >
              <X size={16} strokeWidth={1.75} />
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">
          {children}
        </div>
        {footer ? (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-rule px-5 py-3.5">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function Drawer({
  open,
  onClose,
  children,
  label,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  label: string;
}) {
  const panel = useRef<HTMLElement>(null);
  useEscape(open, onClose);
  useLayerMark(open);
  useFocusTrap(open, panel);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40">
      <button
        aria-label="Close panel"
        className="scrim absolute inset-0"
        onClick={onClose}
      />
      <aside
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className="floating absolute right-0 top-0 flex h-full w-[480px] flex-col rounded-none"
      >
        {children}
      </aside>
    </div>
  );
}
