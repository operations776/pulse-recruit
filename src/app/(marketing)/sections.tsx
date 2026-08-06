import Link from "next/link";
import type { ReactNode } from "react";

// PLS-107. The pieces every marketing page is built from.
//
// One file so the six pages cannot drift into six slightly different heroes.

export function Wrap({ children }: { children: ReactNode }) {
  return <div className="mx-auto max-w-[1180px] px-6">{children}</div>;
}

/** The page hero: eyebrow, headline, one paragraph. */
export function Hero({
  eyebrow,
  title,
  sub,
  children,
}: {
  eyebrow: string;
  title: ReactNode;
  sub?: string;
  children?: ReactNode;
}) {
  return (
    // The violet glow behind the headline is the rebrand's signature. It is a
    // radial gradient rather than an image, so it costs nothing and scales.
    <section className="relative overflow-hidden py-20 text-center">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-[-10%] h-[420px] bg-[radial-gradient(60%_60%_at_50%_0,rgb(157_75_255/0.18),transparent_70%)]"
      />
      <Wrap>
        <div className="relative">
          <p className="legend text-vermilion">{eyebrow}</p>
          <h1 className="display mx-auto mt-4 max-w-[18ch] text-[clamp(2.2rem,5.4vw,3.6rem)] leading-[1.05]">
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
export function SectionHead({
  tag,
  title,
  sub,
}: {
  tag: string;
  title: string;
  sub?: string;
}) {
  return (
    <div className="mx-auto mb-11 max-w-[60ch] text-center">
      <p className="legend text-vermilion">{tag}</p>
      <h2 className="display mt-4 text-[clamp(1.8rem,4vw,2.5rem)] leading-[1.15]">
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
      className="settle lift inline-flex items-center justify-center gap-2 rounded-control bg-vermilion px-6 py-3 text-[15px] font-medium text-on-vermilion shadow-[0_8px_20px_rgb(124_58_237/0.22)] hover:bg-vermilion-hover"
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
      className="settle lift inline-flex items-center justify-center gap-2 rounded-control border border-rule bg-sheet px-6 py-3 text-[15px] font-medium hover:border-vermilion hover:text-vermilion"
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
