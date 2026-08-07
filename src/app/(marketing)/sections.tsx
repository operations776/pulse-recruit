import Link from "next/link";
import type { ReactNode } from "react";

// PLS-107. The pieces every marketing page is built from.
//
// One file so the six pages cannot drift into six slightly different heroes.

export function Wrap({ children }: { children: ReactNode }) {
  return <div className="mx-auto max-w-[1180px] px-6">{children}</div>;
}

/** The page hero: eyebrow, headline, one paragraph. */
// PLS-172. The eyebrow prop and the radial glow are both gone.
//
// The glow was `rgb(157 75 255)`, a hardcoded hex that is not a token, exists
// nowhere else in the codebase, and does not follow the theme: on the dark
// ground it was a violet haze over near-black. It is also the single most
// recognisable tell of a generated interface, and it was copied into two files
// so it fired on all five pages.
//
// The eyebrow is a kicker, banned outright by DESIGN.md 10b. It was also a
// rule 5 violation on every page: violet text on something you cannot click.
export function Hero({
  title,
  sub,
  children,
}: {
  title: ReactNode;
  sub?: string;
  children?: ReactNode;
}) {
  return (
    <section className="py-20 text-center">
      <Wrap>
        <div>
          <h1 className="display mx-auto max-w-[18ch] text-[clamp(2.2rem,5.4vw,3.6rem)] leading-[1.05]">
            {title}
          </h1>
          {sub ? (
            <p className="mx-auto mt-5 max-w-[54ch] text-[clamp(1rem,1.6vw,1.15rem)] leading-[1.6] text-ink-2">
              {sub}
            </p>
          ) : null}
          {children ? <div className="mt-8">{children}</div> : null}
        </div>
      </Wrap>
    </section>
  );
}

/** A centred section heading, used between bands. */
// The `tag` prop is gone, not defaulted, so a kicker cannot come back by
// passing one. DESIGN.md 10b.
export function SectionHead({
  title,
  sub,
}: {
  title: string;
  sub?: string;
}) {
  return (
    <div className="mx-auto mb-11 max-w-[60ch] text-center">
      <h2 className="display text-[clamp(1.8rem,4vw,2.5rem)] leading-[1.15]">
        {title}
      </h2>
      {sub ? (
        <p className="mt-3.5 text-[15px] leading-[1.6] text-ink-2">{sub}</p>
      ) : null}
    </div>
  );
}

/** Alternating page bands, so sections read as separate without a rule. */
export function Band({
  alt = false,
  id,
  children,
}: {
  alt?: boolean;
  id?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className={`py-18 ${alt ? "bg-well" : ""}`}>
      <Wrap>{children}</Wrap>
    </section>
  );
}

export function PrimaryLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      // `.cap`, not a violet halo. A zero-offset coloured glow is decoration
      // and is not one of the three depth treatments DESIGN.md 6 permits; the
      // keycap edge IS the system's way of saying "this is a thing you press",
      // and it presses into its own edge on click.
      className="cap settle inline-flex items-center justify-center gap-2 rounded-control bg-violet px-6 py-3 text-[15px] font-medium text-on-violet hover:bg-violet-hover"
    >
      {children}
    </Link>
  );
}

export function GhostLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="settle lift inline-flex items-center justify-center gap-2 rounded-control border border-rule bg-sheet px-6 py-3 text-[15px] font-medium hover:border-violet hover:text-violet"
    >
      {children}
    </Link>
  );
}

/** The closing call to action every page ends on. */
export function ClosingCta({
  title,
  sub,
}: {
  title: string;
  sub: string;
}) {
  return (
    <Band alt>
      <div className="mx-auto max-w-[60ch] text-center">
        <h2 className="display text-[clamp(1.8rem,4vw,2.5rem)]">{title}</h2>
        <p className="mt-3.5 text-[15px] leading-[1.6] text-ink-2">{sub}</p>
        <div className="mt-7">
          <PrimaryLink href="/signup">Start your pilot</PrimaryLink>
        </div>
      </div>
    </Band>
  );
}
