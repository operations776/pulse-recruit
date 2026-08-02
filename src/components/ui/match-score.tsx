import { ThumbsUp } from "lucide-react";

// DESIGN.md: a score, never a progress bar, never shown without a value.
export function MatchScore({ value }: { value: number }) {
  const tone =
    value >= 85 ? "text-vermilion" : value >= 60 ? "text-ink-soft" : "text-ink-mute";

  return (
    <span className={`flex items-center gap-1 ${tone}`} title="Match score">
      <ThumbsUp size={12} strokeWidth={2} />
      <span className="data-literal text-inherit">{value}%</span>
    </span>
  );
}
