import { TONE_DOT, type Tone } from "./tone";

// PLS-119. A signal on the recruiter's patch. Figma nodes 4:23, 4:27, 4:33,
// 4:39.
//
// Naming: `SignalRow` is also the Postgres row type exported from
// `lib/supabase/types` for the existing signals feed. They live in different
// modules and no file imports both, so this is legal, but a file that ever
// needs the row type and this component together must alias one of them.
//
// The severity union carries four values on Daniyal's spec. The Figma file
// currently draws three: the Note row exists in his PNG export and not in the
// live file. Four is the API either way, and a design that later adds the row
// back needs no type change.

export type SignalSeverity = "act" | "recover" | "watch" | "note";

// DESIGN.md rule 9 wants colour, icon and word. The dot is the icon, matching
// `Activity` in ui/pulse-dot.tsx, and the word is never dropped, which is what
// keeps this readable on a bad monitor or to a colour-blind recruiter.
const SEVERITY: Record<SignalSeverity, { tone: Tone; word: string }> = {
  act: { tone: "act", word: "Act now" },
  recover: { tone: "attend", word: "Recover" },
  watch: { tone: "steady", word: "Watch" },
  note: { tone: "neutral", word: "Note" },
};

export function SignalRow({
  severity,
  headline,
  meta,
  onClick,
}: {
  severity: SignalSeverity;
  headline: string;
  /** The second line: why this matters to this recruiter, in their own terms. */
  meta: string;
  onClick?: () => void;
}) {
  const { tone, word } = SEVERITY[severity];

  // A row with nothing to open is not a button. Rendering one anyway would put
  // a focus stop on static text and promise an interaction that never comes.
  const Tag = onClick ? "button" : "div";

  return (
    <Tag
      {...(onClick ? { type: "button" as const, onClick } : {})}
      className={`settle flex w-full items-center gap-3 border-t border-rule px-4 py-3 text-left ${
        onClick ? "hover:bg-paper" : ""
      }`}
    >
      <span
        aria-hidden
        className={`inline-block size-1.5 shrink-0 rounded-full ${TONE_DOT[tone]}`}
      />

      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[13px] leading-[1.45] text-ink">
          {headline}
        </span>
        <span className="mt-0.5 truncate text-[11px] leading-[1.45] text-ink-3">
          {meta}
        </span>
      </span>

      <span className="legend shrink-0 text-ink-2">{word}</span>
    </Tag>
  );
}

export function SignalsFeed({
  title = "What moved on your patch",
  window: windowLabel = "Last 7 days",
  children,
}: {
  title?: string;
  /** The period the feed covers. Named to avoid shadowing the DOM `window`. */
  window?: string;
  children: React.ReactNode;
}) {
  return (
    // DESIGN.md section 7: rows meet on a shared 1px rule with no gap, so the
    // feed is one sheet rather than a stack of detached cards. Each row draws
    // its own top border and the header supplies the first edge.
    <section className="flex flex-col">
      <div className="flex items-center justify-between gap-4 px-4 pb-2">
        <p className="text-[13px] font-medium leading-[1.45] text-ink">{title}</p>
        <p className="meta shrink-0 text-ink-3">{windowLabel}</p>
      </div>
      {children}
    </section>
  );
}
