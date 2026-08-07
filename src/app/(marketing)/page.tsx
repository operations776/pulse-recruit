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
      <section className="py-24 text-center">
        <Wrap>
          <div>
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
          title="From cold spreadsheet to a living pipeline"
          sub="No migration project. Import what you have and Pulse starts surfacing what needs attention."
        />
        {/* One shell, three panels meeting on a 1px rule with no gap. That is
            DESIGN.md section 1's structural rule, and it is what the app
            already looks like: the marketing site had been using a grid of
            floating cards, which is the shape every SaaS page ships.

            The "Step 01/02/03" labels are gone. They were kickers, and the
            order is already carried by reading left to right. */}
        <div className="overflow-hidden rounded-shell border border-rule bg-sheet md:grid md:grid-cols-3">
          {HOW_IT_WORKS.map((step, index) => (
            <div
              key={step.step}
              className={`p-6 ${
                index > 0
                  ? "border-t border-rule md:border-l md:border-t-0"
                  : ""
              }`}
            >
              <p className="text-[16px] font-semibold">{step.title}</p>
              <p className="mt-2.5 text-[13px] leading-[1.65] text-ink-2">
                {step.body}
              </p>
            </div>
          ))}
        </div>
      </Band>

      <Band id="features">
        <SectionHead
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
              <p className="meta mt-1 text-ink-3">{person.role}</p>
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
