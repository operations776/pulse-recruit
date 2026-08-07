import type { Metadata } from "next";
import {
  AdvisoryDomain,
  AdvisoryDomains,
} from "@/components/bd/advisory-domain";
import { MetricCard, MetricStrip } from "@/components/bd/metric-card";
import { SignalRow, SignalsFeed } from "@/components/bd/signal-row";

// PLS-118 to PLS-120. The component sheet.
//
// The design-review skill has always said "the design sheet at /design is
// always in scope" and PLS-4 recorded it as shipped, but the route did not
// exist. This is it, and it exists for a specific reason: the Rev D components
// render nowhere else yet, so without a page holding them there is nothing to
// photograph, and a component nobody has looked at is not reviewable.
//
// Deliberately OUTSIDE the (app) group. A route added inside it with no entry
// in `modules.ts` falls through `moduleForPath` to TALENT, which is exactly the
// defect the SETTINGS_MODULE comment records: the rail telling you that you
// are in the ATS while you are somewhere else.
//
// Deliberately public. It holds no tenant data, only fixed sample copy taken
// from the Figma file, and being reachable without a session is what lets the
// gate screenshot it in a production build. The opposite mistake, four
// marketing routes missing from PUBLIC_PATHS, is what made the whole marketing
// site unreachable in PLS-107.

export const metadata: Metadata = {
  title: "Component sheet",
  robots: { index: false, follow: false },
};

// Sample copy is the Figma file's own, so a reviewer is comparing like for
// like rather than judging the components against invented strings of a
// convenient length.
const SIGNALS = [
  {
    severity: "act" as const,
    headline: "Marlowe Tech opened 6 backend roles",
    meta: "No agency on PSL. You placed 2 here in 2025.",
  },
  {
    severity: "recover" as const,
    headline: "Halden Group hired 4 without you",
    meta: "Last brief 118 days ago. Talent lead changed in June.",
  },
  {
    severity: "watch" as const,
    headline: "Verity Labs closed a Series B",
    meta: "£40m. Historically hires 20 to 30 in the two quarters after.",
  },
  {
    // Present in Daniyal's export and in the component's severity union, absent
    // from the live Figma file. Rendered here so the fourth tone is reviewable
    // rather than taken on trust.
    severity: "note" as const,
    headline: "Two competitors now list fintech backend",
    meta: "Your patch is getting crowded at the mid level.",
  },
];

const METRICS = [
  { label: "Accounts on patch", value: "34", delta: "+2 this week", tone: "steady" as const },
  { label: "Roles live on patch", value: "19", delta: "+6 in 9 days", tone: "steady" as const },
  { label: "Clients gone quiet", value: "7", delta: "3 over 90 days", tone: "attend" as const },
  { label: "BD time last week", value: "4.5h", delta: "down from 7h", tone: "weak" as const },
];

const DOMAINS = [
  { domain: "The market", reading: "Hiring up 12 percent on your patch", status: "steady" as const },
  { domain: "Your offer", reading: "No price anchor. Weakest link right now", status: "weak" as const },
  { domain: "Your clients", reading: "3 accounts silent past 90 days", status: "attend" as const },
  { domain: "Your systems", reading: "Sourcing stack fine. No follow-up rule", status: "neutral" as const },
  { domain: "Your week", reading: "BD time down 36 percent", status: "attend" as const },
];

function Section({
  title,
  note,
  width,
  children,
}: {
  title: string;
  note: string;
  /**
   * Constrains the shell, not the content inside it. A component that is 320px
   * wide by design needs a 320px sheet around it; stretching the sheet to the
   * page and letting the sample sit in the corner leaves most of a panel doing
   * nothing, which is the complaint that drove PLS-85.
   */
  width?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="display text-[13px] font-bold text-ink">{title}</h2>
        <p className="mt-1 text-[12px] leading-[1.5] text-ink-2">{note}</p>
      </div>
      {/* One shell per section, per DESIGN.md section 7: the sample sits inside
          a ruled sheet so the component's own edges are legible against it. */}
      <div
        className={`overflow-hidden rounded-shell border border-rule bg-sheet py-2 ${width ?? ""}`}
      >
        {children}
      </div>
    </section>
  );
}

export default function ComponentSheet() {
  return (
    <main className="min-h-screen bg-paper px-8 py-12">
      <div className="mx-auto flex max-w-[1064px] flex-col gap-8">
        <header>
          <p className="legend text-ink-3">Pulse Recruit / Rev D</p>
          <h1 className="display mt-2 text-[18px] font-extrabold tracking-[-0.01em] text-ink">
            BD Strategist components
          </h1>
          <p className="mt-2 max-w-[60ch] text-[13px] leading-[1.5] text-ink-2">
            Three components ported from the BD Strategist redesign, on the
            shipped token set rather than the file&rsquo;s raw values. Nothing
            here is approved yet. Sample copy is the Figma file&rsquo;s own so
            the comparison is like for like.
          </p>
        </header>

        <Section
          title="Metric card"
          note="The delta tone is a prop, not read off the sign. BD time went down and is red; accounts went up and are teal. Deriving tone from direction gets the fourth card backwards."
        >
          <div className="px-4 py-2">
            <MetricStrip>
              {METRICS.map((m) => (
                <MetricCard key={m.label} {...m} />
              ))}
            </MetricStrip>
          </div>
        </Section>

        <Section
          title="Signal row"
          note="Four severities: act, recover, watch, note. Colour, dot and word on every one, so the row survives a bad monitor. Act is violet because the row is the click target, not because a badge is decorative."
        >
          <SignalsFeed>
            {SIGNALS.map((s) => (
              <SignalRow key={s.headline} {...s} />
            ))}
          </SignalsFeed>
        </Section>

        <Section
          title="Advisory domain"
          note="The reading is a status prop rather than a colour baked per domain. Your offer is red today because there is no price anchor, not because offers are red."
          // 320px is the persona panel's real width in Figma, so the sample is
          // shown at the size it will actually be used at rather than stretched
          // across a page it will never occupy.
          width="w-[320px]"
        >
          <AdvisoryDomains title="What the strategist is watching">
            {DOMAINS.map((d) => (
              <AdvisoryDomain key={d.domain} {...d} />
            ))}
          </AdvisoryDomains>
        </Section>
      </div>
    </main>
  );
}
