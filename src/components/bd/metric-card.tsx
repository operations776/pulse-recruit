import { TONE_TEXT, type Tone } from "./tone";

// PLS-118. The metrics strip. Figma nodes 4:2, 4:3, 4:8, 4:13, 4:18.
//
// The delta's tone is a prop rather than something derived from the sign,
// because the design proves direction and goodness are different questions:
// "+2 this week" is green, "3 over 90 days" is amber, and "down from 7h" is
// red on a number that went DOWN. A component that coloured by sign would get
// the last one exactly backwards.

export type MetricTone = Extract<Tone, "steady" | "attend" | "weak" | "neutral">;

export function MetricCard({
  label,
  value,
  delta,
  tone = "neutral",
}: {
  label: string;
  /** Pre-formatted, so the caller owns units: "34", "4.5h", "62%". */
  value: string;
  delta?: string;
  tone?: MetricTone;
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-0.5 rounded-shell border border-rule bg-sheet px-4 py-3">
      <p className="truncate text-[11px] leading-[1.45] text-ink-3">{label}</p>
      <div className="flex items-baseline gap-2">
        {/* Tabular figures so a strip of four does not jitter as values
            change. `.meta` is the 10px mono treatment, so the size and weight
            are set here rather than inherited from it. */}
        <p className="meta shrink-0 text-[19px] font-medium tracking-[-0.02em] text-ink">
          {value}
        </p>
        {delta ? (
          <p className={`meta shrink-0 truncate ${TONE_TEXT[tone]}`}>{delta}</p>
        ) : null}
      </div>
    </div>
  );
}

export function MetricStrip({ children }: { children: React.ReactNode }) {
  // The one place this strip departs from section 7. Everywhere else in the
  // product, sections inside a shell share a 1px rule with no gap; the design
  // draws four separate cards with a gap between them, and adopting Rev D
  // means adopting that. The gap is 10px in Figma and 12px here, because 10 is
  // not on the 4px scale and 12 is the nearest value that is.
  return <div className="flex items-stretch gap-3">{children}</div>;
}
