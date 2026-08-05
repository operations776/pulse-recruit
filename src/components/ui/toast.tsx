"use client";

import { AlertTriangle, Check, X } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

// DESIGN.md section 2: toasts PERSIST until dismissed. A state change nobody
// finished reading is an invisible state change. There is no auto-dismiss here
// and adding one is a regression.
//
// Section 9 rule: status is colour plus icon plus word, always all three.

type Tone = "default" | "danger";
type Toast = { id: number; message: string; tone: Tone };

const ToastContext = createContext<{
  notify: (message: string, tone?: Tone) => void;
} | null>(null);

let sequence = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const notify = useCallback((message: string, tone: Tone = "default") => {
    sequence += 1;
    setToasts((prev) => [...prev, { id: sequence, message, tone }]);
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const value = useMemo(() => ({ notify }), [notify]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* Toasts persist until dismissed, and a right hand drawer is 480px of
          the same corner, so a stack of two would sit permanently on top of
          the drawer's own buttons and swallow the clicks. The drawer marks the
          body while it is open and globals.css moves the stack to the other
          side for as long as that lasts. */}
      <div className="toast-stack pointer-events-none fixed bottom-6 right-6 z-[60] flex w-[380px] max-w-[calc(100vw-3rem)] flex-col gap-3">
        {toasts.map((t) => {
          const danger = t.tone === "danger";
          const Icon = danger ? AlertTriangle : Check;
          return (
            <div
              key={t.id}
              role="status"
              className={`floating toast-in pointer-events-auto flex items-start gap-3 rounded-shell border p-4 ${
                danger ? "border-red" : "border-rule"
              }`}
            >
              <Icon
                size={20}
                strokeWidth={2}
                className={`mt-0.5 shrink-0 ${danger ? "text-red" : "text-teal"}`}
              />
              <span className="flex-1 text-[12px] leading-[1.5] text-ink">
                <span className="legend mr-2 text-ink-2">
                  {danger ? "Warning" : "Done"}
                </span>
                {t.message}
              </span>
              <button
                onClick={() => dismiss(t.id)}
                aria-label="Dismiss notification"
                className="-m-1 flex size-7 shrink-0 items-center justify-center rounded-control text-ink-2 hover:bg-well hover:text-ink"
              >
                <X size={18} strokeWidth={2} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside ToastProvider");
  return ctx;
}
