import {
  ArrowRight,
  BarChart3,
  Check,
  Kanban,
  Radio,
  Sparkles,
  Users,
  Zap,
} from "lucide-react";
import Link from "next/link";

import { brand } from "@/config/brand";


// Taste-lock sheet for the marketing surface, judged against DESIGN.md.
// Structure follows the reference; palette and voice are ours.
//
// Every control on this page navigates, so every control is a link. The
// UI-first build left them as handler-less buttons and href="#", which
// rendered a page where nothing opened. A CTA that cannot navigate is not a
// design choice, it is a broken promise with a hover state.

// The Button primitive renders a real button element; these are links wearing
// its exact clothes, same keycap edge, same radius.
const PRIMARY_LINK =
  "cap inline-flex items-center justify-center gap-2 rounded-control bg-vermilion text-on-vermilion hover:bg-vermilion-hover [--edge:var(--color-vermilion-edge)] font-medium";
const SECONDARY_LINK =
  "cap inline-flex items-center justify-center gap-2 rounded-control border border-ink bg-transparent text-ink hover:bg-well [--edge:var(--color-ink)] font-medium";

const features = [
  {
    icon: Kanban,
    title: "Pipeline that stays warm",
    body: "Every candidate carries an activity signal, so the ones going cold surface before you lose them.",
  },
  {
    icon: Users,
    title: "One record per person",
    body: "Contact, history, notes, and documents in a single view. No tab switching, no duplicate records.",
  },
  {
    icon: Radio,
    title: "Signals that start conversations",
    body: "Open roles, funding, and leadership moves land in a feed you can act on the same morning.",
  },
  {
    icon: Sparkles,
    title: "An ops manager that works",
    body: "Ask for the shortlist, the follow ups, or the week ahead. It answers from your own data.",
  },
  {
    icon: BarChart3,
    title: "Numbers that mean something",
    body: "Time to first touch, source quality, and stage velocity. The metrics that change what you do next.",
  },
  {
    icon: Zap,
    title: "Fast enough to live in",
    body: "Every screen budgeted and measured on each release. Opening a pipeline should never make you wait.",
  },
];

const plan = [
  "Unlimited candidates and companies",
  "Pipeline board and candidate records",
  "250 enrichment credits each month",
  "Signals feed and saved searches",
  "Email and calendar connected",
];

export default function MarketingHome() {
  return (
    <div className="flex-1 bg-sheet">
      {/* Nav */}
      <header className="sticky top-0 z-10 border-b border-rule bg-sheet/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between px-6">
          <span className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-control bg-ink">
              <span className="size-2 rounded-full bg-teal" />
            </span>
            <span className="display text-[13px] font-bold">
              {brand.name}
            </span>
          </span>
          {/* Only sections that exist get a nav entry. Customers and
              Resources were links to nowhere, and a dead link is worse than a
              shorter nav. They come back when their pages do. */}
          <nav className="hidden items-center gap-7 text-[12px] font-medium text-ink-2 md:flex">
            <a href="#product" className="hover:text-ink">Product</a>
            <a href="#pricing" className="hover:text-ink">Pricing</a>
          </nav>
          <span className="flex items-center gap-2">
            <Link
              href="/signin"
              className="px-2 text-[12px] font-medium text-ink-2 hover:text-ink"
            >
              Log in
            </Link>
            <Link href="/signup" className={`${PRIMARY_LINK} h-8 px-3.5 text-[12px]`}>
              Start your pilot
            </Link>
          </span>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-[1200px] px-6 pb-16 pt-20 text-center">
        <span className="inline-flex">
          <span className="legend text-ink-2">Now in pilot</span>
        </span>
        <h1 className="mx-auto mt-6 max-w-[13ch] display text-[60px] font-bold leading-[62px] tracking-[-0.03em]">
          The ATS that keeps your pipeline{" "}
          <span className="grad-fresh">alive</span>
        </h1>
        <p className="mx-auto mt-5 max-w-[52ch] text-[18px] leading-6 text-ink-2">
          Pulse runs the daily operations of a recruitment agency: candidates,
          clients, outreach signals, and the follow ups you would otherwise
          forget.
        </p>
        <div className="mt-7 flex items-center justify-center gap-3">
          <Link href="/signup" className={`${PRIMARY_LINK} h-11 px-5 text-[13px]`}>
            Start your pilot
            <ArrowRight size={16} strokeWidth={2} />
          </Link>
          <a href="#product" className={`${SECONDARY_LINK} h-11 px-5 text-[13px]`}>
            See how it works
          </a>
        </div>
        <p className="mt-4 text-[12px] text-ink-3">
          Founding price for the first ten agencies. No card required.
        </p>

        {/* Product frame on a soft wash */}
        <div className="mt-14 rounded-control bg-gradient-to-br from-well via-paper to-hue-mustard/10 p-3">
          <div className="overflow-hidden rounded-control border border-rule bg-sheet ">
            <div className="flex h-9 items-center gap-1.5 border-b border-rule bg-paper px-3">
              <span className="size-2.5 rounded-full bg-hue-vermilion/70" />
              <span className="size-2.5 rounded-full bg-hue-mustard/70" />
              <span className="size-2.5 rounded-full bg-teal/70" />
            </div>
            <div className="flex">
              <div className="w-12 shrink-0 border-r border-rule bg-sheet py-3">
                <div className="mx-auto flex flex-col items-center gap-2">
                  {[0, 1, 2, 3].map((i) => (
                    <span
                      key={i}
                      className={`size-6 rounded-control ${i === 0 ? "bg-ink" : "bg-well"}`}
                    />
                  ))}
                </div>
              </div>
              <div className="flex flex-1 gap-2.5 p-4 text-left">
                {["Applied", "Test", "Interview", "Offer"].map((stage, i) => (
                  <div key={stage} className="flex-1">
                    <div className="mb-2 flex items-center gap-1.5">
                      <span className={`size-2 rounded-control bg-ink`} />
                      <span className="text-[12px] font-semibold">{stage}</span>
                    </div>
                    <div className="flex flex-col gap-2">
                      {Array.from({ length: 3 - (i % 2) }).map((_, j) => (
                        <div
                          key={j}
                          className="rounded-control border border-rule bg-sheet p-2 "
                        >
                          <div className="flex items-center gap-1.5">
                            <span className={`size-5 rounded-full bg-well`} />
                            <span className="h-1.5 w-12 rounded-full bg-rule" />
                          </div>
                          <div className="mt-2 flex items-center justify-between">
                            <span className="h-1 w-10 rounded-full bg-rule" />
                            <span className="h-1 w-5 rounded-full bg-teal/50" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="product" className="border-t border-rule bg-paper py-20">
        <div className="mx-auto max-w-[1200px] px-6">
          <div className="text-center">
            <span className="legend text-ink-2">Everything in one place</span>
            <h2 className="mt-5 display text-[40px] font-bold leading-[46px] tracking-[-0.02em]">
              All the tools. <span className="grad-warm">Zero bloat.</span>
            </h2>
            <p className="mx-auto mt-4 max-w-[46ch] text-[12px] leading-6 text-ink-2">
              Built for the way a small agency actually runs a week, not for a
              procurement checklist.
            </p>
          </div>

          <div className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {features.map(({ icon: Icon, title, body }) => {
              
              return (
                <div
                  key={title}
                  className="rounded-control border border-rule bg-sheet p-5 "
                >
                  <span
                    className={`flex size-9 items-center justify-center rounded-control bg-well`}
                  >
                    <Icon size={17} strokeWidth={2} className="text-ink-2" />
                  </span>
                  <h3 className="mt-4 text-[12px] font-semibold">{title}</h3>
                  <p className="mt-1.5 text-[12px] leading-5 text-ink-2">
                    {body}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20">
        <div className="mx-auto max-w-[1200px] px-6 text-center">
          <span className="legend text-ink-2">Pricing</span>
          <h2 className="mt-5 display text-[40px] font-bold leading-[46px] tracking-[-0.02em]">
            One plan, <span className="grad-fresh">priced for founders</span>
          </h2>

          <div className="mx-auto mt-10 max-w-[420px] overflow-hidden rounded-control border border-rule bg-sheet text-left ">
            <div className="bg-ink px-6 py-5 text-sheet">
              <p className="legend text-sheet/60">Founding agency</p>
              <p className="mt-2 flex items-baseline gap-1.5">
                <span className="display text-[40px] font-bold leading-none">
                  $50
                </span>
                <span className="meta text-sheet/60">/month</span>
              </p>
              <p className="mt-2 text-[12px] text-sheet/70">
                Locked for the first ten agencies, then $299.
              </p>
            </div>
            <div className="p-6">
              <ul className="flex flex-col gap-2.5">
                {plan.map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-[12px]">
                    <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-well">
                      <Check size={11} strokeWidth={3} className="text-vermilion" />
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
              <Link
                href="/signup"
                className={`${PRIMARY_LINK} mt-6 h-11 w-full text-[13px]`}
              >
                Start your pilot
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Closing band */}
      <section className="mx-auto max-w-[1200px] px-6 pb-20">
        <div className="relative overflow-hidden rounded-control bg-ink px-10 py-14 text-sheet">
          <span className="pointer-events-none absolute -right-16 -top-16 size-64 rounded-full bg-vermilion/25 blur-3xl" />
          <span className="pointer-events-none absolute -bottom-24 right-32 size-64 rounded-full bg-hue-mustard/15 blur-3xl" />
          <div className="relative max-w-[30ch]">
            <h2 className="display text-[36px] font-bold leading-[42px] tracking-[-0.02em]">
              Stop losing candidates to the follow up you forgot.
            </h2>
            <p className="mt-4 text-[12px] leading-6 text-sheet/70">
              Ten agencies, founding price, ninety day pilot.
            </p>
            <Link
              href="/signup"
              className={`${PRIMARY_LINK} mt-7 h-11 px-5 text-[13px]`}
            >
              Start your pilot
              <ArrowRight size={16} strokeWidth={2} />
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-rule py-8">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between px-6 text-[12px] text-ink-3">
          <span className="flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-teal" />
            All systems operational
          </span>
          <span className="meta">
            2026 {brand.company}
          </span>
        </div>
      </footer>
    </div>
  );
}
