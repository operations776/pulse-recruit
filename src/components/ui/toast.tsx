"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

// DESIGN.md: no fallback recipients, no silent partial success. Every action
// that changes data reports honestly, including the count it actually touched.

type Toast = { id: number; message: string; tone: "default" | "danger" };

const ToastContext = createContext<{
  notify: (message: string, tone?: Toast["tone"]) => void;
} | null>(null);

let toastSequence = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const notify = useCallback(
    (message: string, tone: Toast["tone"] = "default") => {
      toastSequence += 1;
      const id = toastSequence;
      setToasts((prev) => [...prev, { id, message, tone }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 3200);
    },
    [],
  );

  const value = useMemo(() => ({ notify }), [notify]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-6 right-6 z-[60] flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`pointer-events-auto rounded-xl px-4 py-2.5 text-[13px] font-medium text-white shadow-pop ${
              t.tone === "danger" ? "bg-danger-500" : "bg-forest-900"
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside ToastProvider");
  return ctx;
}
