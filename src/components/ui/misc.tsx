"use client";

import { Check, Copy } from "lucide-react";
import { useState, type ReactNode } from "react";
import { hueText, hueTint, type Hue } from "@/lib/hue";

export function Badge({
  children,
  hue,
  solid = false,
}: {
  children: ReactNode;
  hue: Hue | "emerald" | "neutral";
  solid?: boolean;
}) {
  if (hue === "emerald") {
    return (
      <span
        className={`micro-label inline-flex h-5 items-center rounded-md px-1.5 ${
          solid ? "bg-emerald-600 text-white" : "bg-emerald-50 text-emerald-700"
        }`}
      >
        {children}
      </span>
    );
  }
  if (hue === "neutral") {
    return (
      <span className="micro-label inline-flex h-5 items-center rounded-md bg-line-soft px-1.5 text-ink-600">
        {children}
      </span>
    );
  }
  return (
    <span
      className={`micro-label inline-flex h-5 items-center rounded-md px-1.5 ${hueTint[hue]} ${hueText[hue]}`}
    >
      {children}
    </span>
  );
}

export function StatusDot({ state }: { state: "open" | "risk" | "closed" }) {
  const tone =
    state === "open"
      ? "bg-emerald-500"
      : state === "risk"
        ? "bg-hue-amber"
        : "bg-ink-400";
  return <span className={`size-1.5 shrink-0 rounded-full ${tone}`} />;
}

export function Breadcrumb({ trail }: { trail: string[] }) {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-[12px] text-ink-400">
      {trail.map((item, i) => (
        <span key={item} className="flex items-center gap-1.5">
          {i > 0 ? <span aria-hidden>/</span> : null}
          <span className={i === trail.length - 1 ? "text-ink-600" : ""}>
            {item}
          </span>
        </span>
      ))}
    </nav>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded-[4px] border border-line bg-canvas px-1 font-mono text-[11px] text-ink-400">
      {children}
    </kbd>
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-surface px-6 py-14 text-center">
      <p className="text-[15px] font-semibold">{title}</p>
      <p className="mt-1.5 max-w-[42ch] text-[13px] text-ink-600">{body}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

// DESIGN.md: click copies, confirmation is a 900ms inline swap, never a toast.
export function CopyField({
  value,
  label,
  href,
}: {
  value: string;
  label?: string;
  href?: string;
}) {
  const [copied, setCopied] = useState(false);

  if (!value) {
    return <span className="text-[13px] text-ink-400">Not provided</span>;
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // Clipboard can be blocked by permissions. Still confirm the intent so
      // the control never looks dead, and leave the value selectable.
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 900);
  };

  return (
    <span className="group flex items-center gap-1.5">
      {href ? (
        <a
          href={href}
          className="data-literal truncate text-ink-900 hover:text-emerald-700 hover:underline"
        >
          {value}
        </a>
      ) : (
        <span className="data-literal truncate text-ink-900">{value}</span>
      )}
      <button
        onClick={copy}
        aria-label={`Copy ${label ?? value}`}
        className="shrink-0 rounded p-0.5 text-ink-400 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
      >
        {copied ? (
          <Check size={13} strokeWidth={2} className="text-emerald-600" />
        ) : (
          <Copy size={13} strokeWidth={1.75} />
        )}
      </button>
      {copied ? (
        <span className="text-[11px] font-medium text-emerald-600">Copied</span>
      ) : null}
    </span>
  );
}
