// PLS-118 to PLS-120. The Rev D reading ramp.
//
// The redesign colours three different things from one small set: a signal's
// urgency, an advisory domain's health, and a metric's direction. Naming that
// set once keeps the three components from each inventing their own vocabulary
// and drifting, which is what happened to the old design-review checklist.
//
// Every value here is an existing token. The Figma file carries near-misses of
// our palette rather than a new ramp, every one within a few percent; the
// value-by-value mapping is recorded in TICKETS.md under Rev D. Two reasons
// not to paste the literals: DESIGN.md rule 1 allows tokens only, and a raw
// hex cannot flip, so hardcoding would leave this screen in permanent light
// mode while the rest of the product follows the theme.
//
// DESIGN.md section 3 constraint, carried over from the content skill accents:
// these hues carry a reading, never a state on their own. Every consumer also
// prints a word.

export type Tone = "act" | "steady" | "attend" | "weak" | "neutral";

/** Dot fill. 7px in the design, which is the size the pulse dot already uses. */
export const TONE_DOT: Record<Tone, string> = {
  // Violet is the verb (rule 5). It is legal here because every surface using
  // this tone is itself clickable: a signal row opens the company, it is not a
  // decorative badge.
  act: "bg-violet",
  steady: "bg-teal",
  attend: "bg-amber",
  weak: "bg-red",
  neutral: "bg-ink-3",
};

/** Text colour, for a metric delta or a severity word. */
export const TONE_TEXT: Record<Tone, string> = {
  act: "text-violet",
  steady: "text-teal-text",
  attend: "text-amber-text",
  weak: "text-red",
  neutral: "text-ink-3",
};
