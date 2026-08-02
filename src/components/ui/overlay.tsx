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
        className="scrim absolute inset-0"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="floating relative w-full max-w-[460px] rounded-shell"
      >
        <div className="flex items-start justify-between gap-4 px-5 pb-3 pt-5">
          <div>
            <h2 className="display text-[18px] font-semibold leading-6">
              {title}
            </h2>
            {description ? (
              <p className="mt-1 text-[15px] text-ink-2">{description}</p>
            ) : null}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-control p-1 text-ink-3 hover:bg-paper hover:text-ink"
          >
            <X size={16} strokeWidth={1.75} />
          </button>
        </div>
        <div className="px-5 pb-5">{children}</div>
        {footer ? (
          <div className="flex justify-end gap-2 border-t border-rule px-5 py-3.5">
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
        className="scrim absolute inset-0"
        onClick={onClose}
      />
      <aside
        aria-label={label}
        className="floating absolute right-0 top-0 flex h-full w-[480px] flex-col rounded-none"
      >
        {children}
      </aside>
    </div>
  );
}
