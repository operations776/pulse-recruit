import type { Metadata } from "next";
import { brand } from "@/config/brand";
import { FEATURES } from "@/config/marketing";
import { Band, ClosingCta, Hero, SectionHead } from "../sections";

export const metadata: Metadata = {
  title: `Features — ${brand.name}`,
  description:
    "Placements, candidates, clients, and the signals that keep every search moving, in one live system.",
};

// The four detail rows from the rebrand's features page. Each is a claim plus
// the three things that back it, and a small mock of the actual screen.
const ROWS = [
  {
    title: "A pipeline that stays warm",
    body: "Every candidate and search carries an activity signal, so the ones going quiet surface before they ghost rather than after.",
    points: [
      "Placement stages from sourcing to placed",
      "Per-stage candidate counts at a glance",
      "Cold-spot flags before a candidate goes quiet",
    ],
    mock: [
      ["G. Guest, final interview", "Hot"],
      ["J. Wolf, screen", "Follow up"],
      ["P. How, offer sent", "Closing"],
    ],
  },
  {
    title: "One record per person",
    body: "Candidate and client profiles with every touch on one timeline, attributed to the teammate who took it.",
    points: [
      "Unified candidate and client profiles",
      "Every touch and note in one timeline",
      "Attribution on every action, by teammate",
    ],
    mock: [
      ["Contact and role", "Synced"],
      ["Interview history", "6 notes"],
      ["Documents", "CV, JD"],
    ],
  },
  {
    title: "Signals that start conversations",
    body: "Funding, hiring and leadership moves on the companies you are chasing, with the evidence attached.",
    points: [
      "Hiring, funding, and job-move signals",
      "Saved searches that watch your patch",
      "Straight from the feed to the first touch",
    ],
    mock: [
      ["Meridian Labs, Series B", "Just raised"],
      ["Corewave, VP Eng hire", "New role"],
      ["Northstar, no TA lead", "Gap"],
    ],
  },
  {
    title: "Numbers that mean something",
    body: "The three numbers that actually predict a placement, rather than a dashboard nobody opens twice.",
    points: [
      "Time to first touch per search",
      "Source quality by channel",
      "Stage velocity across the desk",
    ],
    mock: [
      ["Time to first touch", "1.4 days"],
      ["Reply rate", "13%"],
      ["Stage velocity", "6 days"],
    ],
  },
] as const;

export default function FeaturesPage() {
  return (
    <>
      <Hero
        title="Everything your desk runs on, in one live system"
        sub={`${brand.name} is built around how a boutique agency actually works: placements, candidates, clients, and the signals that keep every search moving.`}
      />

      <Band>
        <div className="flex flex-col gap-16">
          {ROWS.map((row, index) => (
            <div
              key={row.title}
              className={`grid items-center gap-10 lg:grid-cols-2 ${
                // Alternating sides, so four rows do not read as a list.
                index % 2 === 1 ? "lg:[&>*:first-child]:order-2" : ""
              }`}
            >
              <div>
                                <h2 className="display-lg mt-3 text-[clamp(1.5rem,3vw,2rem)]">
                  {row.title}
                </h2>
                <p className="mt-3.5 text-[15px] leading-[1.65] text-ink-2">
                  {row.body}
                </p>
                <ul className="mt-5 grid gap-2.5">
                  {row.points.map((point) => (
                    <li
                      key={point}
                      className="flex items-start gap-2.5 text-[14px]"
                    >
                      <span
                        aria-hidden
                        className="mt-[7px] size-1.5 shrink-0 rounded-full bg-violet"
                      />
                      {point}
                    </li>
                  ))}
                </ul>
              </div>

              {/* A window frame rather than a screenshot: a real screenshot
                  would need updating every time the product moves, and would
                  be stale within a week. */}
              <div className="overflow-hidden rounded-shell border border-rule bg-sheet shadow-[0_18px_44px_rgb(27_21_38/0.10)]">
                <div className="flex items-center gap-1.5 border-b border-rule px-4 py-3">
                  {["#e7e1f4", "#e7e1f4", "#e7e1f4"].map((c, i) => (
                    <span
                      key={i}
                      aria-hidden
                      className="size-2.5 rounded-full"
                      style={{ background: c }}
                    />
                  ))}
                </div>
                <ul>
                  {row.mock.map(([label, value], i) => (
                    <li
                      key={label}
                      className={`flex items-center justify-between gap-4 px-4 py-3.5 text-[13px] ${
                        i > 0 ? "border-t border-rule" : ""
                      }`}
                    >
                      <span className="font-medium">{label}</span>
                      <span className="meta text-ink-2">{value}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </Band>

      <Band alt>
        <SectionHead
          title="All the tools. Zero bloat."
          sub="The rest of what your agency runs on, without the parts you would never open."
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
      </Band>

      <ClosingCta
        title="See it on your own pipeline."
        sub="Import what you have and Pulse starts surfacing what needs attention the same day."
      />
    </>
  );
}
