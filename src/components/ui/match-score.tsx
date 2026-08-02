import { ThumbsUp } from "lucide-react";

// Vermilion is a verb: a score is not clickable, so it is never vermilion.
// Strong matches read teal ("on"), the rest are plain ink.
export function MatchScore({ value }: { value: number }) {
  const strong = value >= 85;
  return (
    <span
      className={`flex items-center gap-1.5 ${strong ? "text-teal-text" : "text-ink-2"}`}
      title={`Match score ${value} percent`}
    >
      <ThumbsUp size={15} strokeWidth={2} />
      <span className="meta text-inherit">{value}%</span>
    </span>
  );
}
