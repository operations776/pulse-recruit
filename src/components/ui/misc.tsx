"use client";

import {
  AlertTriangle,
  Check,
  CircleDot,
  Copy,
  MinusCircle,
  XCircle,
} from "lucide-react";
import { useState, type ReactNode } from "react";

// DESIGN.md rule 9: status is colour PLUS icon PLUS word, always all three.
// Never colour alone, because lens yellowing after 50 compresses discrimination.
//
// `danger` is for a thing that tried and did not work, as against `attention`,
// which is a thing that still might. A failed publish is the first state in the
// app that is genuinely finished and wrong, so it gets its own icon rather than
// borrowing the warning triangle.
const tones = {
  on: { cls: "bg-teal-bg border-teal text-teal-text", icon: CircleDot },
  attention: { cls: "bg-amber-bg border-amber text-amber-text", icon: AlertTriangle },
  danger: { cls: "bg-red-bg border-red text-red", icon: XCircle },
  off: { cls: "bg-well border-rule text-ink-2", icon: MinusCircle },
} as const;

export type Tone = keyof typeof tones;

export function StatusChip({ tone, children }: { tone: Tone; children: ReactNode }) {
  const { cls, icon: Icon } = tones[tone];
  return (
    <span
      className={`legend inline-flex items-center gap-1.5 rounded-chip border px-2 py-1 ${cls}`}
    >
      <Icon size={13} strokeWidth={2.25} />
      {children}
    </span>
  );
}

// Kept for call sites that pass a semantic name rather than a tone.
export function Badge({
  hue,
  children,
}: {
  hue: "accent" | "teal" | "neutral";
  children: ReactNode;
}) {
  const tone: Tone = hue === "teal" ? "on" : hue === "accent" ? "on" : "off";
  return <StatusChip tone={tone}>{children}</StatusChip>;
}

export function StatusDot({ state }: { state: "open" | "risk" | "closed" }) {
  const tone: Tone = state === "open" ? "on" : state === "risk" ? "attention" : "off";
  const word = state === "open" ? "Open" : state === "risk" ? "At risk" : "Closed";
  return <StatusChip tone={tone}>{word}</StatusChip>;
}

export function Breadcrumb({ trail }: { trail: string[] }) {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-[12px] text-ink-2">
      {trail.map((item, i) => (
        <span key={item} className="flex items-center gap-2">
          {i > 0 ? <span aria-hidden>/</span> : null}
          <span className={i === trail.length - 1 ? "text-ink" : ""}>{item}</span>
        </span>
      ))}
    </nav>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="well rounded-chip px-1.5 py-0.5 font-mono text-[12px] text-ink-2">
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
    <div className="flex flex-col items-center justify-center rounded-shell border border-rule bg-sheet px-6 py-12 text-center">
      <p className="display text-[18px]">{title}</p>
      <p className="mt-2 max-w-[52ch] text-[13px] text-ink-2">{body}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

// Nothing lives behind hover: the copy control is always visible, 44px target.
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
    return <span className="text-[13px] text-ink-3">Not provided</span>;
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
    <span className="flex items-center gap-2">
      {href ? (
        <a href={href} className="meta truncate text-ink underline-offset-2 hover:underline">
          {value}
        </a>
      ) : (
        <span className="meta truncate text-ink">{value}</span>
      )}
      <button
        onClick={copy}
        aria-label={`Copy ${label ?? value}`}
        className="-m-1 flex size-7 shrink-0 items-center justify-center rounded-control text-ink-2 hover:bg-well hover:text-ink"
      >
        {copied ? (
          <Check size={16} strokeWidth={2.5} className="text-teal" />
        ) : (
          <Copy size={16} strokeWidth={2} />
        )}
      </button>
      {copied ? <span className="legend text-teal-text">Copied</span> : null}
    </span>
  );
}
