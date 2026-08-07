import { AlertTriangle } from "lucide-react";

// PLS-110. The strategist's own state, said in colour, icon and word.
//
// DESIGN.md rule 9 wants all three. The dot is the icon here, which is the
// established idiom in this codebase rather than an improvisation: `Activity`
// in `ui/pulse-dot.tsx` and the live marker in `run-log.tsx` both say state
// with a dot and a word, and `.pulse-dot-live` is the one ambient animation
// section 10 allows.
//
// Teal is "on, running, engaged", so it belongs to Thinking and to nothing
// else on this screen. Ready is not a running thing, so it is neutral ink
// rather than a second teal: the baseline state should not compete with the
// working one for attention. Unavailable is amber, matching the banner the
// composer already raises when a platform key is missing, so one condition is
// not described two different ways in one view.

export type AgentState = "ready" | "thinking" | "unavailable";

export function AgentStatus({
  state,
  detail,
}: {
  state: AgentState;
  /**
   * The live phase, for example "Searching the web". Carried as the title
   * rather than as the label: the word stays "Thinking" so the control does
   * not reflow through seven different widths during a single run, and the
   * transcript's run log is already showing the phase at full size.
   */
  detail?: string | null;
}) {
  if (state === "unavailable") {
    return (
      <span className="flex min-w-0 items-center gap-1.5">
        <AlertTriangle
          size={16}
          strokeWidth={1.5}
          className="size-3.5 shrink-0 text-amber"
          aria-hidden
        />
        <span className="legend truncate text-amber-text">Unavailable</span>
      </span>
    );
  }

  const thinking = state === "thinking";

  return (
    <span
      className="flex min-w-0 items-center gap-1.5"
      title={thinking ? (detail ?? undefined) : undefined}
    >
      <span
        aria-hidden
        className={`inline-block size-1.5 shrink-0 rounded-full ${
          thinking ? "bg-teal pulse-dot-live" : "bg-ink-3"
        }`}
      />
      {/* aria-live so a screen reader hears the run start and finish. The dot
          is decorative, so the word carries the whole announcement. */}
      <span
        aria-live="polite"
        className={`legend truncate ${thinking ? "text-teal-text" : "text-ink-2"}`}
      >
        {thinking ? "Thinking" : "Ready"}
      </span>
    </span>
  );
}
