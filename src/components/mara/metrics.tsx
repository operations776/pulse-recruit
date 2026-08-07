// PLS-112. The four metric tiles.
//
// Three are computed from real rows today: accounts on patch is the Dream 100,
// roles live is open jobs, clients gone quiet is companies with no activity in
// 90 days. BD time has no source, because nothing in the product tracks hours
// yet, so its tile carries `pending` and says so rather than showing an
// invented number that would end up in a screenshot.

export type Metric = {
  label: string;
  value: string;
  /** The small coloured delta under the number. */
  delta?: string;
  tone?: "good" | "warn" | "bad";
  /** True when there is no data source yet and the value is a placeholder. */
  pending?: boolean;
};

// The -deep variants, not the base colours. A base status colour is tuned for
// a 7px dot, where contrast is not the constraint; as text it measured 2.5:1
// against a 4.5:1 requirement. The dots elsewhere still use the base.
const TONE = {
  good: "text-mara-good-deep",
  warn: "text-mara-warn-deep",
  bad: "text-mara-bad-deep",
} as const;

export function MetricsStrip({ metrics }: { metrics: Metric[] }) {
  return (
    <div className="flex w-full items-start gap-2.5 pt-1">
      {metrics.map((metric) => (
        <div
          key={metric.label}
          className="raised flex min-w-0 flex-1 flex-col gap-0.5 rounded-card border border-mara-rule bg-mara-sheet px-3.5 py-3"
        >
          <p className="flex items-center gap-1.5 text-[11px] leading-[1.45] text-mara-ink-3">
            {metric.label}
            {metric.pending ? (
              // Says it plainly. A number with no source that is not labelled
              // is the kind of thing that ends up in a pitch deck.
              <span
                title="No data source for this yet"
                className="rounded-chip border border-mara-rule px-1 text-[11px] uppercase tracking-wide"
              >
                soon
              </span>
            ) : null}
          </p>
          <div className="flex items-baseline gap-[7px]">
            <p
              className={`font-mono text-[19px] font-medium tracking-[-0.38px] ${
                metric.pending ? "text-mara-ink-3" : "text-mara-ink"
              }`}
            >
              {metric.value}
            </p>
            {metric.delta ? (
              <p
                className={`font-mono text-[11px] tracking-[-0.1px] ${
                  metric.tone ? TONE[metric.tone] : "text-mara-ink-3"
                }`}
              >
                {metric.delta}
              </p>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}
