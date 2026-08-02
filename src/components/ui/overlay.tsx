"use client";

import { X } from "lucide-react";
import { useEffect, type ReactNode } from "react";

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

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  useEscape(open, onClose);
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        aria-label="Close dialog"
        className="absolute inset-0 bg-ink-900/25"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative w-full max-w-[440px] rounded-2xl bg-surface shadow-pop"
      >
        <div className="flex items-start justify-between gap-4 px-5 pb-3 pt-5">
          <div>
            <h2 className="font-display text-[18px] font-semibold leading-6">
              {title}
            </h2>
            {description ? (
              <p className="mt-1 text-[13px] text-ink-600">{description}</p>
            ) : null}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1 text-ink-400 hover:bg-canvas hover:text-ink-900"
          >
            <X size={16} strokeWidth={1.75} />
          </button>
        </div>
        <div className="px-5 pb-5">{children}</div>
        {footer ? (
          <div className="flex justify-end gap-2 border-t border-line px-5 py-3.5">
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
  useEscape(open, onClose);
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40">
      <button
        aria-label="Close panel"
        className="absolute inset-0 bg-ink-900/20"
        onClick={onClose}
      />
      <aside
        aria-label={label}
        className="absolute right-0 top-0 flex h-full w-[480px] flex-col border-l border-line bg-surface shadow-pop"
      >
        {children}
      </aside>
    </div>
  );
}
