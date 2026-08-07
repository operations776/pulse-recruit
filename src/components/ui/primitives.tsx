import type { ReactNode } from "react";

/**
 * PLS-178. The primitives from the Figma handoff's component inventory.
 *
 * Built before the screens, on purpose. The handoff's own instruction is to go
 * component by component rather than screen by screen, because otherwise each
 * screen invents its own chip and the design system exists only in the file
 * that describes it.
 *
 * `Surface` lives in surface.tsx; `Avatar` and `Button` already existed and
 * were extended in place rather than duplicated here.
 */

/* ------------------------------------------------------------------ Chip */

/**
 * A pill. 20px radius, per DESIGN.md section 5 Rev E.
 *
 * Four variants because the handoff names four jobs, and they are genuinely
 * different: a `state` chip says what something IS, a `skill` chip categorises,
 * a `meta` chip is a fact, and a `gap` chip is something the product is asking
 * you for. Only `gap` is interactive by default.
 */
export type ChipVariant = "state" | "skill" | "meta" | "gap";
export type ChipTone = "neutral" | "good" | "attention" | "info" | "problem" | "brand";

const CHIP_TONES: Record<ChipTone, string> = {
  neutral: "border-rule bg-sheet text-ink-2",
  good: "border-teal-bg bg-teal-bg text-teal-text",
  attention: "border-amber-edge bg-amber-bg text-amber-text",
  info: "border-info-bg bg-info-bg text-info",
  problem: "border-red-bg bg-red-bg text-red",
  // Text on a tinted fill uses that family's dark stop, never black or grey.
  brand: "border-violet-100 bg-violet-wash text-violet-deep",
};

export function Chip({
  variant = "meta",
  tone = "neutral",
  className = "",
  children,
  ...rest
}: {
  variant?: ChipVariant;
  tone?: ChipTone;
  className?: string;
  children: ReactNode;
} & Record<string, unknown>) {
  // `state` is mono because a state label is system-generated; the others
  // carry human words and stay in the reading face.
  const face =
    variant === "state"
      ? "font-mono text-[10px] uppercase tracking-[0.06em]"
      : "text-[11px]";

  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-chip border px-2.5 py-1 leading-[1.45] ${face} ${CHIP_TONES[tone]} ${className}`}
      {...rest}
    >
      {children}
    </span>
  );
}

/* -------------------------------------------------------------- MonoLabel */

/**
 * Uppercase mono, 8 to 11px, muted by default.
 *
 * The handoff's scope for mono is "anything measured or system-generated":
 * counts, percentages, fit scores, timestamps, state labels, keyboard hints,
 * IDs, date ranges. If a human wrote the words, this is the wrong component.
 */
export function MonoLabel({
  className = "",
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={`font-mono text-[10px] uppercase leading-[1.45] tracking-[0.06em] text-ink-3 ${className}`}
    >
      {children}
    </span>
  );
}

/* --------------------------------------------------------------- StatDot */

/**
 * A 6 to 8px semantic dot, used across every list in the product.
 *
 * DESIGN.md rule 9 has not changed: a dot is never the only thing saying what
 * a state is. Every caller pairs it with a word, and the `label` here is what
 * a screen reader gets so the colour is never load-bearing for anybody.
 */
export type StatTone = "good" | "attention" | "info" | "problem" | "neutral" | "brand";

const DOT: Record<StatTone, string> = {
  good: "bg-teal",
  attention: "bg-amber",
  info: "bg-info",
  problem: "bg-red",
  neutral: "bg-ink-3",
  brand: "bg-violet",
};

export function StatDot({
  tone,
  label,
  size = 7,
}: {
  tone: StatTone;
  /** Read out instead of the colour. Omit only when adjacent text says it. */
  label?: string;
  size?: 6 | 7 | 8;
}) {
  return (
    <span
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      style={{ width: size, height: size }}
      className={`inline-block shrink-0 rounded-full ${DOT[tone]}`}
    />
  );
}

/* ------------------------------------------------------------- MetricTile */

/**
 * A label, a mono value, and a delta that carries its own meaning.
 *
 * The delta tone is a prop rather than derived from the sign, because "down
 * from 7h" on BD time is GOOD news wearing a minus sign. Deriving colour from
 * direction is how a metric strip ends up lying.
 *
 * `pending` is for a number with no source yet. It renders "--" behind a
 * "soon" badge rather than a plausible figure, which is the same rule the BD
 * metrics already follow: a number nobody can trace is worse than an absence.
 */
export function MetricTile({
  label,
  value,
  delta,
  deltaTone = "neutral",
  pending = false,
}: {
  label: string;
  value: string;
  delta?: string;
  deltaTone?: StatTone;
  pending?: boolean;
}) {
  const deltaColour: Record<StatTone, string> = {
    good: "text-teal-text",
    attention: "text-amber-text",
    info: "text-info",
    problem: "text-red",
    neutral: "text-ink-3",
    brand: "text-violet-deep",
  };

  return (
    <div className="raised flex min-w-0 flex-1 flex-col gap-0.5 rounded-card border border-rule bg-sheet px-3.5 py-3">
      <p className="flex items-center gap-1.5 text-[11px] leading-[1.45] text-ink-3">
        {label}
        {pending ? (
          <span
            title="No data source for this yet"
            className="rounded-chip border border-rule px-1 font-mono text-[10px] uppercase"
          >
            soon
          </span>
        ) : null}
      </p>
      <div className="flex items-baseline gap-[7px]">
        <p
          className={`font-mono text-[19px] font-medium tracking-[-0.38px] ${
            pending ? "text-ink-3" : "text-ink"
          }`}
        >
          {value}
        </p>
        {delta ? (
          <p className={`font-mono text-[11px] tracking-[-0.1px] ${deltaColour[deltaTone]}`}>
            {delta}
          </p>
        ) : null}
      </div>
    </div>
  );
}
