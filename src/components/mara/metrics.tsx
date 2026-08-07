import { MetricTile, type StatTone } from "@/components/ui/primitives";

// PLS-112, rebuilt on the shared primitive in PLS-178.
//
// This file used to carry its own copy of the tile markup. That is exactly the
// duplication MetricTile exists to end: a second definition of a card drifts
// from the first the moment either is touched, and the mara-* palette fork
// already proved that in this codebase.
//
// Three of the four numbers come from real rows: accounts on patch is the
// Dream 100, roles live is open jobs, clients gone quiet is companies with no
// activity in 90 days. BD time has no source anywhere in Pulse, so its tile
// carries `pending` and says so rather than showing an invented number that
// would end up in a screenshot.

export type Metric = {
  label: string;
  value: string;
  /** The small coloured delta under the number. */
  delta?: string;
  /**
   * Passed, never derived from the sign.
   *
   * "down from 7h" on BD time is good news wearing a minus sign, so a
   * component that coloured by direction would call it a loss.
   */
  tone?: "good" | "warn" | "bad";
  /** True when there is no data source yet and the value is a placeholder. */
  pending?: boolean;
};

// The local vocabulary maps onto the shared semantic one. Kept as a mapping
// rather than a rename so the eleven call sites do not all have to change in
// the same commit that introduces the primitive.
const TONE: Record<NonNullable<Metric["tone"]>, StatTone> = {
  good: "good",
  warn: "attention",
  bad: "problem",
};

export function MetricsStrip({ metrics }: { metrics: Metric[] }) {
  return (
    <div className="flex w-full items-start gap-2.5 pt-1">
      {metrics.map((metric) => (
        <MetricTile
          key={metric.label}
          label={metric.label}
          value={metric.value}
          delta={metric.delta}
          deltaTone={metric.tone ? TONE[metric.tone] : "neutral"}
          pending={metric.pending}
        />
      ))}
    </div>
  );
}
