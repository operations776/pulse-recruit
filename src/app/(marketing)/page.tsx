import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { brand } from "@/config/brand";
import { FEATURES, HERO, HOW_IT_WORKS, TEAM } from "@/config/marketing";
import {
  Band,
  ClosingCta,
  GhostLink,
  PrimaryLink,
  SectionHead,
  Wrap,
} from "./sections";
import { HeroWord } from "./hero-word";

// PLS-107. The landing page, rebuilt on the rebrand's structure.
//
// Every control navigates. The UI-first build left these as handler-less
// buttons and href="#", which rendered a page where nothing opened; a CTA that
// cannot navigate is a broken promise with a hover state.
export default function MarketingPage() {
  return (
    <>
      {/* Hero. The violet glow is a radial gradient rather than an image, so
          it costs nothing and scales to any width. */}
      <section className="relative overflow-hidden py-24 text-center">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-[-10%] h-[460px] bg-[radial-gradient(60%_60%_at_50%_0,rgb(157_75_255/0.18),transparent_70%)]"
        />
        <Wrap>
          <div className="relative">
            <h1 className="display mx-auto max-w-[20ch] text-[clamp(2.3rem,5.6vw,3.8rem)] leading-[1.05]">
              {HERO.headline} <HeroWord words={[...HERO.cycle]} />
            </h1>
            <p className="mx-auto mt-6 max-w-[54ch] text-[clamp(1rem,1.6vw,1.2rem)] leading-[1.6] text-ink-2">
              {HERO.sub}
            </p>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
              <PrimaryLink href="/signup">Start your pilot</PrimaryLink>
              <GhostLink href="#how-it-works">See how it works</GhostLink>
              <GhostLink href="/pricing">Pricing</GhostLink>
            </div>
          </div>
        </Wrap>
      </section>

      <Band alt id="how-it-works">
        <SectionHead
          tag="How it works"
          title="From cold spreadsheet to a living pipeline"
          sub="No migration project. Import what you have and Pulse starts surfacing what needs attention."
        />
        <div className="grid gap-4 md:grid-cols-3">
          {HOW_IT_WORKS.map((step) => (
            <div
              key={step.step}
              className="settle lift rounded-card border border-rule bg-sheet p-6 hover:border-violet"
            >
              <p className="legend text-violet">{step.step}</p>
              <p className="mt-3 text-[16px] font-semibold">{step.title}</p>
              <p className="mt-2.5 text-[13px] leading-[1.65] text-ink-2">
                {step.body}
              </p>
            </div>
          ))}
        </div>
      </Band>

      <Band id="features">
        <SectionHead
          tag="Everything in one place"
          title="All the tools. Zero bloat."
          sub="Built for the way a small agency actually runs a week, not for a procurement checklist."
        />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => (
            <div
              key={feature.title}
              className="settle lift rounded-card border border-rule bg-sheet p-5 hover:border-violet"
            >
              <p className="text-[15px] font-semibold">{feature.title}</p>
              <p className="mt-2 text-[13px] leading-[1.6] text-ink-2">
                {feature.body}
              </p>
            </div>
          ))}
        </div>
        <div className="mt-8 text-center">
          <Link
            href="/features"
            className="settle inline-flex items-center gap-1.5 text-[14px] font-medium text-violet hover:gap-2.5"
          >
            Explore all features
            <ArrowRight size={16} strokeWidth={2} />
          </Link>
        </div>
      </Band>

      <Band alt id="team">
        <SectionHead
          tag="Meet the team"
          title={`The people behind ${brand.name}`}
          sub="A small team that runs recruiting operations on Pulse every day, and builds it."
        />
        <div className="mx-auto grid max-w-[760px] gap-4 sm:grid-cols-2">
          {TEAM.map((person) => (
            <div
              key={person.name}
              className="rounded-card border border-rule bg-sheet p-6"
            >
              {/* Initials rather than a photo. The rebrand embeds two base64
                  JPEGs; a monogram carries the same information at a fraction
                  of the bytes and never goes stale. */}
              <span className="display flex size-12 items-center justify-center rounded-card bg-violet text-[15px] text-on-violet">
                {person.name
                  .split(" ")
                  .map((part) => part[0])
                  .join("")}
              </span>
              <p className="mt-4 text-[16px] font-semibold">{person.name}</p>
              <p className="legend mt-1 text-violet">{person.role}</p>
              <p className="mt-3 text-[13px] leading-[1.65] text-ink-2">
                {person.body}
              </p>
            </div>
          ))}
        </div>
      </Band>

      <ClosingCta
        title="Keep your pipeline alive."
        sub="Bring your agency's searches into one board today and never lose a candidate to silence again."
      />
    </>
  );
}
