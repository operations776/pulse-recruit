import { TONE_DOT, type Tone } from "./tone";

// PLS-120. What the strategist is watching. Figma nodes 4:51, 4:53, 4:58,
// 4:63, 4:68, 4:73.
//
// The design hardcodes a hue per domain: the market green, your offer red,
// your clients amber, your systems grey, your week amber. Read again, those
// are not domain identities, they are readings that change as the data does.
// Your offer is red because there is no price anchor today, not because offers
// are red. So the reading is a prop, and the five domains are just rows.
//
// This matters beyond tidiness. DESIGN.md rule 9 forbids a hue that only
// carries a state, and a per-domain colour baked into the component would be
// exactly that: a colour saying "bad" with nothing else saying it. The reading
// word is rendered for screen readers so the dot is never the only signal.

export type DomainReading = Extract<
  Tone,
  "steady" | "attend" | "weak" | "neutral"
>;

const READING_WORD: Record<DomainReading, string> = {
  steady: "Healthy",
  attend: "Needs attention",
  weak: "Weakest link",
  neutral: "No reading yet",
};

export function AdvisoryDomain({
  domain,
  reading,
  status = "neutral",
}: {
  /** "The market", "Your offer", "Your clients", "Your systems", "Your week". */
  domain: string;
  /** One line of what the strategist currently believes about it. */
  reading: string;
  status?: DomainReading;
}) {
  return (
    // first:border-t-0 because the design rules BETWEEN rows, not above the
    // first one: Figma 4:53 carries no top border and 4:58 onward do. Without
    // this the section title gets a second hairline under it. It works because
    // AdvisoryDomains puts the rows in their own wrapper, so :first-child is a
    // row rather than the title.
    <div className="flex items-start gap-3 border-t border-rule px-4 py-3 first:border-t-0">
      <span
        aria-hidden
        className={`mt-1 inline-block size-1.5 shrink-0 rounded-full ${TONE_DOT[status]}`}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <p className="truncate text-[13px] leading-[1.45] text-ink">
          {domain}
          {/* Colour plus word, without spending a line on it. The dot is
              decorative, so the reading has to be legible some other way. */}
          <span className="sr-only">, {READING_WORD[status]}</span>
        </p>
        <p className="mt-0.5 text-[11px] leading-[1.45] text-ink-3">{reading}</p>
      </div>
    </div>
  );
}

export function AdvisoryDomains({
  title = "What the strategist is watching",
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col border-t border-rule">
      <p className="px-4 pt-5 pb-1 text-[11px] leading-[1.45] text-ink-3">
        {title}
      </p>
      {/* The rows get their own wrapper so the first-row rule reset above has
          a :first-child to match. With the title as a sibling it would target
          the title instead and the extra hairline would survive the fix. */}
      <div className="flex flex-col">{children}</div>
    </section>
  );
}
