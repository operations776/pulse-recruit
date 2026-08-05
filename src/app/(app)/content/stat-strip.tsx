"use client";

/**
 * `tone` is what the number MEANS, not what colour to paint it.
 *
 * `neutral` is a count. `good` is work already done. `warn` is work waiting.
 * `bad` is something that broke and needs a person. Everything was amber
 * before, which put "five ideas waiting" and "two posts LinkedIn refused" in
 * the same visual register.
 */
export type StatTone = "neutral" | "good" | "warn" | "bad";

export type Stat = {
  label: string;
  value: number;
  tone?: StatTone;
};

// A zero never shouts, whatever its tone. On a planner most numbers are zero
// most of the time, and a row of coloured zeroes reads as an error state.
const TONES: Record<StatTone, { value: string; label: string; chip: string }> = {
  neutral: { value: "text-ink", label: "text-ink-3", chip: "" },
  good: { value: "text-teal-text", label: "text-teal-text", chip: "bg-teal-bg" },
  warn: {
    value: "text-amber-text",
    label: "text-amber-text",
    chip: "bg-amber-bg",
  },
  bad: { value: "text-red", label: "text-red", chip: "bg-red-bg" },
};

/**
 * The counts, inline.
 *
 * These used to be a `dl` of four 21px Archivo numerals separated by 40px
 * gaps, filling about a quarter of a 1400px row and costing 53px of height to
 * say four two-digit numbers. This carries more of them, in one 28px band, at
 * the width they actually need.
 */
export function StatStrip({ stats }: { stats: Stat[] }) {
  return (
    <dl className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
      {stats.map((stat) => {
        const tone = TONES[stat.tone ?? "neutral"];
        const live = stat.value > 0;

        return (
          <div
            key={stat.label}
            className={`settle flex items-baseline gap-1.5 rounded-chip px-2 py-1 ${
              live ? tone.chip : ""
            }`}
          >
            <dd
              className={`meta tabular-nums ${
                live ? `font-medium ${tone.value}` : "text-ink-3"
              }`}
            >
              {stat.value}
            </dd>
            <dt className={`legend ${live ? tone.label : "text-ink-3"}`}>
              {stat.label}
            </dt>
          </div>
        );
      })}
    </dl>
  );
}
