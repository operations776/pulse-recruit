// The activity signature. DESIGN.md: the only ambient animation in the product.
// Cold is the state Pulse exists to eliminate.

export type Freshness = "live" | "warm" | "cold";

export function freshnessFor(lastActivity: Date, now: Date): Freshness {
  const hours = (now.getTime() - lastActivity.getTime()) / 3_600_000;
  if (hours < 48) return "live";
  if (hours < 24 * 7) return "warm";
  return "cold";
}

export function PulseDot({ freshness }: { freshness: Freshness }) {
  if (freshness === "cold") {
    return (
      <span className="inline-block size-1.5 shrink-0 rounded-full border-[1.5px] border-mustard" />
    );
  }
  return (
    <span
      className={`inline-block size-1.5 shrink-0 rounded-full ${
        freshness === "live"
          ? "bg-sage pulse-dot-live"
          : "bg-ink-mute"
      }`}
    />
  );
}

export function Activity({
  freshness,
  label,
}: {
  freshness: Freshness;
  label: string;
}) {
  return (
    <span className="flex items-center gap-1.5">
      <PulseDot freshness={freshness} />
      <span className="data-literal text-ink-mute">{label}</span>
    </span>
  );
}
