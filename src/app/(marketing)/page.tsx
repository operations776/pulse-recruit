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
import { Button } from "@/components/ui/button";
import { EyebrowPill } from "@/components/ui/eyebrow-pill";
import { brand } from "@/config/brand";
import { hueBg, hueByIndex, hueText, hueTint } from "@/lib/hue";

// Taste-lock sheet for the marketing surface, judged against DESIGN.md.
// Structure follows the reference; palette and voice are ours.

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
    <div className="flex-1 bg-paper-white">
      {/* Nav */}
      <header className="sticky top-0 z-10 border-b border-rule bg-paper-white/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between px-6">
          <span className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-sharp bg-ink">
              <span className="size-2 rounded-full bg-sage" />
            </span>
            <span className="font-display text-[17px] font-bold">
              {brand.name}
            </span>
          </span>
          <nav className="hidden items-center gap-7 text-[13px] font-medium text-ink-soft md:flex">
            <a href="#" className="hover:text-ink">Product</a>
            <a href="#" className="hover:text-ink">Pricing</a>
            <a href="#" className="hover:text-ink">Customers</a>
            <a href="#" className="hover:text-ink">Resources</a>
          </nav>
          <span className="flex items-center gap-2">
            <a href="#" className="px-2 text-[13px] font-medium text-ink-soft hover:text-ink">
              Log in
            </a>
            <Button variant="primary">Book a demo</Button>
          </span>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-[1200px] px-6 pb-16 pt-20 text-center">
        <span className="inline-flex">
          <EyebrowPill icon={Sparkles} label="Now in pilot" hue="mustard" />
        </span>
        <h1 className="mx-auto mt-6 max-w-[13ch] font-display text-[60px] font-bold leading-[62px] tracking-[-0.03em]">
          The ATS that keeps your pipeline{" "}
          <span className="grad-fresh">alive</span>
        </h1>
        <p className="mx-auto mt-5 max-w-[52ch] text-[16px] leading-6 text-ink-soft">
          Pulse runs the daily operations of a recruitment agency: candidates,
          clients, outreach signals, and the follow ups you would otherwise
          forget.
        </p>
        <div className="mt-7 flex items-center justify-center gap-3">
          <Button variant="primary" className="h-11 px-5 text-[14px]">
            Book a demo
            <ArrowRight size={16} strokeWidth={2} />
          </Button>
          <Button className="h-11 px-5 text-[14px]">See how it works</Button>
        </div>
        <p className="mt-4 text-[12px] text-ink-mute">
          Founding price for the first ten agencies. No card required.
        </p>

        {/* Product frame on a soft wash */}
        <div className="mt-14 rounded-sharp bg-gradient-to-br from-vermilion-wash via-paper to-hue-mustard/10 p-3">
          <div className="overflow-hidden rounded-sharp border border-rule bg-paper-white ">
            <div className="flex h-9 items-center gap-1.5 border-b border-rule bg-paper px-3">
              <span className="size-2.5 rounded-full bg-hue-vermilion/70" />
              <span className="size-2.5 rounded-full bg-hue-mustard/70" />
              <span className="size-2.5 rounded-full bg-sage/70" />
            </div>
            <div className="flex">
              <div className="w-12 shrink-0 border-r border-rule bg-paper-white py-3">
                <div className="mx-auto flex flex-col items-center gap-2">
                  {[0, 1, 2, 3].map((i) => (
                    <span
                      key={i}
                      className={`size-6 rounded-sharp ${i === 0 ? hueBg[hueByIndex(0)] : "bg-rule"}`}
                    />
                  ))}
                </div>
              </div>
              <div className="flex flex-1 gap-2.5 p-4 text-left">
                {["Applied", "Test", "Interview", "Offer"].map((stage, i) => (
                  <div key={stage} className="flex-1">
                    <div className="mb-2 flex items-center gap-1.5">
                      <span className={`size-2 rounded-sharp ${hueBg[hueByIndex(i)]}`} />
                      <span className="text-[11px] font-semibold">{stage}</span>
                    </div>
                    <div className="flex flex-col gap-2">
                      {Array.from({ length: 3 - (i % 2) }).map((_, j) => (
                        <div
                          key={j}
                          className="rounded-sharp border border-rule bg-paper-white p-2 "
                        >
                          <div className="flex items-center gap-1.5">
                            <span className={`size-5 rounded-full ${hueTint[hueByIndex(i + j)]}`} />
                            <span className="h-1.5 w-12 rounded-full bg-rule" />
                          </div>
                          <div className="mt-2 flex items-center justify-between">
                            <span className="h-1 w-10 rounded-full bg-rule" />
                            <span className="h-1 w-5 rounded-full bg-sage/50" />
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
      <section className="border-t border-rule bg-paper py-20">
        <div className="mx-auto max-w-[1200px] px-6">
          <div className="text-center">
            <EyebrowPill icon={Kanban} label="Everything in one place" hue="teal" />
            <h2 className="mt-5 font-display text-[40px] font-bold leading-[46px] tracking-[-0.02em]">
              All the tools. <span className="grad-warm">Zero bloat.</span>
            </h2>
            <p className="mx-auto mt-4 max-w-[46ch] text-[15px] leading-6 text-ink-soft">
              Built for the way a small agency actually runs a week, not for a
              procurement checklist.
            </p>
          </div>

          <div className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {features.map(({ icon: Icon, title, body }, i) => {
              const hue = hueByIndex(i);
              return (
                <div
                  key={title}
                  className="rounded-sharp border border-rule bg-paper-white p-5 "
                >
                  <span
                    className={`flex size-9 items-center justify-center rounded-sharp ${hueTint[hue]}`}
                  >
                    <Icon size={17} strokeWidth={2} className={hueText[hue]} />
                  </span>
                  <h3 className="mt-4 text-[15px] font-semibold">{title}</h3>
                  <p className="mt-1.5 text-[13px] leading-5 text-ink-soft">
                    {body}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-20">
        <div className="mx-auto max-w-[1200px] px-6 text-center">
          <EyebrowPill icon={Zap} label="Pricing" hue="vermilion" />
          <h2 className="mt-5 font-display text-[40px] font-bold leading-[46px] tracking-[-0.02em]">
            One plan, <span className="grad-fresh">priced for founders</span>
          </h2>

          <div className="mx-auto mt-10 max-w-[420px] overflow-hidden rounded-sharp border border-rule bg-paper-white text-left ">
            <div className="bg-ink px-6 py-5 text-white">
              <p className="micro-label text-white/60">Founding agency</p>
              <p className="mt-2 flex items-baseline gap-1.5">
                <span className="font-display text-[40px] font-bold leading-none">
                  $50
                </span>
                <span className="data-literal text-white/60">/month</span>
              </p>
              <p className="mt-2 text-[13px] text-white/70">
                Locked for the first ten agencies, then $299.
              </p>
            </div>
            <div className="p-6">
              <ul className="flex flex-col gap-2.5">
                {plan.map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-[13px]">
                    <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-vermilion-wash">
                      <Check size={11} strokeWidth={3} className="text-vermilion" />
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
              <Button variant="primary" className="mt-6 h-11 w-full text-[14px]">
                Book a demo
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Closing band */}
      <section className="mx-auto max-w-[1200px] px-6 pb-20">
        <div className="relative overflow-hidden rounded-sharp bg-ink px-10 py-14 text-white">
          <span className="pointer-events-none absolute -right-16 -top-16 size-64 rounded-full bg-vermilion/25 blur-3xl" />
          <span className="pointer-events-none absolute -bottom-24 right-32 size-64 rounded-full bg-hue-mustard/15 blur-3xl" />
          <div className="relative max-w-[30ch]">
            <h2 className="font-display text-[36px] font-bold leading-[42px] tracking-[-0.02em]">
              Stop losing candidates to the follow up you forgot.
            </h2>
            <p className="mt-4 text-[15px] leading-6 text-white/70">
              Ten agencies, founding price, ninety day pilot.
            </p>
            <Button variant="primary" className="mt-7 h-11 px-5 text-[14px]">
              Book a demo
              <ArrowRight size={16} strokeWidth={2} />
            </Button>
          </div>
        </div>
      </section>

      <footer className="border-t border-rule py-8">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between px-6 text-[12px] text-ink-mute">
          <span className="flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-sage" />
            All systems operational
          </span>
          <span className="data-literal">
            2026 {brand.company}
          </span>
        </div>
      </footer>
    </div>
  );
}
