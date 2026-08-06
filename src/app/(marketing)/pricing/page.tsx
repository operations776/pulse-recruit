import { Check } from "lucide-react";
import type { Metadata } from "next";
import { brand } from "@/config/brand";
import { PRICING } from "@/config/marketing";
import {
  Band,
  ClosingCta,
  Hero,
  PrimaryLink,
  SectionHead,
} from "../sections";

export const metadata: Metadata = {
  title: `Pricing — ${brand.name}`,
  description:
    "One plan at a founding rate. No tiers, no seat maths, the whole desk included.",
};

// PLS-107. Pricing.
//
// Ported exactly from the rebrand, because the numbers are a commercial
// decision Daniyal has already taken: $50 a month for the first ten agencies,
// then $299, and the founding group keeps its rate. That matches the founding
// price already recorded in TICKETS.md.
export default function PricingPage() {
  return (
    <>
      <Hero
        eyebrow="Pricing"
        title="One plan. Founding-agency price."
        sub="We are onboarding a small group of founding agencies at a locked-in rate before general pricing starts. No tiers, no seat maths: the whole desk is included."
      />

      <Band>
        <div className="flex justify-center">
          {/* The dark card is the rebrand's one inverted surface. It is fixed
              rather than themed: this is the thing the page exists to show,
              and it should look the same to everyone. */}
          <div className="w-full max-w-[520px] rounded-shell border border-[#2a1c48] bg-[linear-gradient(165deg,#1c1136,#120a24)] p-11 text-[#e8e4f4] shadow-[0_30px_70px_rgb(76_29_149/0.2)]">
            <span className="legend inline-block rounded-chip border border-[rgb(168_85_247/0.38)] bg-[rgb(168_85_247/0.16)] px-3 py-1.5 text-[#d8b4fe]">
              {PRICING.badge}
            </span>

            <p className="display mt-6 flex items-baseline gap-2 text-[3.5rem] leading-none text-white">
              {PRICING.amount}
              <span className="text-[1rem] font-medium text-[#b6acce]">
                {PRICING.period}
              </span>
            </p>
            <p className="mt-3 text-[14px] text-[#9d95b8]">{PRICING.after}</p>

            <ul className="mt-7 grid gap-3.5">
              {PRICING.includes.map((line) => (
                <li key={line} className="flex items-start gap-3 text-[15px]">
                  <Check
                    size={16}
                    strokeWidth={2.4}
                    className="mt-0.5 shrink-0 text-[#c084fc]"
                    aria-hidden
                  />
                  {line}
                </li>
              ))}
            </ul>

            <div className="mt-8">
              <PrimaryLink href="/signup">Start your pilot</PrimaryLink>
            </div>
          </div>
        </div>

        <p className="mt-5 text-center text-[13px] text-ink-3">{PRICING.note}</p>
      </Band>

      <Band alt>
        <SectionHead
          tag="Everything included"
          title="One price, the whole platform"
        />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PRICING.everything.map((item) => (
            <div
              key={item.title}
              className="settle lift rounded-card border border-rule bg-sheet p-5 hover:border-vermilion"
            >
              <p className="text-[15px] font-semibold">{item.title}</p>
              <p className="mt-2 text-[13px] leading-[1.6] text-ink-2">
                {item.body}
              </p>
            </div>
          ))}
        </div>
      </Band>

      <ClosingCta
        title="Claim a founding seat."
        sub="Ten agencies, one locked-in rate. Import your pipeline and see it live the same day."
      />
    </>
  );
}
