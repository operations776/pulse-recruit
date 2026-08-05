"use client";

export type Stat = {
  label: string;
  value: number;
  /** Amber when this number is the one asking for attention. */
  attention?: boolean;
};

/**
 * The counts, inline.
 *
 * These used to be a `dl` of four 21px Archivo numerals separated by 40px
 * gaps, filling about a quarter of a 1400px row and costing 53px of height to
 * say four two-digit numbers. This carries more of them, in one 28px band, at
 * the width they actually need.
 *
 * A zero is muted rather than shouted: on a planner most numbers are zero most
 * of the time, and four bold zeroes read as an error state.
 */
export function StatStrip({ stats }: { stats: Stat[] }) {
  return (
    <dl className="flex min-w-0 flex-wrap items-baseline gap-x-4 gap-y-1">
      {stats.map((stat) => (
        <div key={stat.label} className="flex items-baseline gap-1.5">
          <dd
            className={`meta tabular-nums ${
              stat.value === 0
                ? "text-ink-3"
                : stat.attention
                  ? "font-medium text-amber-text"
                  : "font-medium text-ink"
            }`}
          >
            {stat.value}
          </dd>
          <dt
            className={`legend ${
              stat.attention && stat.value > 0 ? "text-amber-text" : "text-ink-3"
            }`}
          >
            {stat.label}
          </dt>
        </div>
      ))}
    </dl>
  );
}
