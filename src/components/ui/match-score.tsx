import { ThumbsUp } from "lucide-react";

// A bare "match" number with nothing stated to match against is noise, which is
// why it was removed from the all-roles candidates table. Here the role is
// unambiguous (one board, one role, or the drawer opened from it), so the score
// is labelled with its basis rather than left to be guessed at.
//
// Violet is a verb: a score is not clickable, so it is never violet.
export function MatchScore({
  value,
  roleTitle,
  withLabel = false,
}: {
  value: number;
  roleTitle?: string;
  withLabel?: boolean;
}) {
  const strong = value >= 85;
  const basis = roleTitle ? `Fit to ${roleTitle}` : "Fit to this role";

  return (
    <span
      className={`flex items-center gap-1.5 ${strong ? "text-teal-text" : "text-ink-2"}`}
      title={`${basis}: ${value} percent, scored on title, seniority and skills`}
    >
      <ThumbsUp size={13} strokeWidth={2} />
      <span className="meta text-inherit">{value}%</span>
      {withLabel ? <span className="legend text-ink-3">fit</span> : null}
    </span>
  );
}
