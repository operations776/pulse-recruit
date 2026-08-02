"use client";

import {
  ArrowUpRight,
  Banknote,
  Briefcase,
  Globe2,
  Plus,
  TrendingUp,
  UserRoundCog,
} from "lucide-react";
import { useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import { PulseDot, freshnessFor } from "@/components/ui/pulse-dot";
import { useToast } from "@/components/ui/toast";
import { hueText, hueTint, type Hue } from "@/lib/hue";
import { NOW } from "@/lib/mock/seed";
import { useStore } from "@/lib/store";
import { relativeTime } from "@/lib/time";
import type { SignalKind } from "@/lib/types";

// Each kind owns a fixed hue and icon so the eye learns them. Fixed, not
// hashed, so two kinds can never collide.
const KIND: Record<
  SignalKind,
  { label: string; hue: Hue; icon: typeof Briefcase }
> = {
  funding: { label: "Funding", hue: "vermilion", icon: Banknote },
  promotion: { label: "Promotion", hue: "mustard", icon: TrendingUp },
  open_role: { label: "Open role", hue: "teal", icon: Briefcase },
  leadership: { label: "Leadership", hue: "plum", icon: UserRoundCog },
  expansion: { label: "Expansion", hue: "sage", icon: Globe2 },
};

const FILTERS = [
  { key: "all", label: "All" },
  { key: "funding", label: "Funding" },
  { key: "promotion", label: "Promotions" },
  { key: "open_role", label: "Open roles" },
  { key: "leadership", label: "Leadership" },
  { key: "expansion", label: "Expansion" },
] as const;

export default function SignalsPage() {
  const { state, dismissSignal } = useStore();
  const { notify } = useToast();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("all");

  const live = state.signals.filter((s) => !s.dismissed);
  const shown = filter === "all" ? live : live.filter((s) => s.kind === filter);

  const watched = state.dreamCompanies;
  const moving = new Set(live.map((s) => s.dreamCompanyId)).size;

  return (
    <main className="flex min-w-0 flex-1 overflow-hidden bg-paper">
      <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
        <header className="border-b border-rule-strong px-6 py-5">
          <p className="micro-label text-vermilion">Dream 100 watchlist</p>
          <h1 className="display mt-2 text-[26px] leading-7">Signals</h1>
          <p className="mt-2 max-w-[62ch] text-[13px] text-ink-soft">
            What the companies you are chasing did this week. Every signal is a
            reason to call someone today.
          </p>

          <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-2">
            {[
              ["Companies watched", String(watched.length)],
              ["Live signals", String(live.length)],
              ["Companies moving", `${moving}/${watched.length}`],
            ].map(([label, value]) => (
              <div key={label} className="flex items-baseline gap-2">
                <dt className="micro-label text-ink-mute">{label}</dt>
                <dd className="display text-[15px] leading-5">{value}</dd>
              </div>
            ))}
          </dl>
        </header>

        <nav className="flex flex-wrap items-center border-b border-rule-strong">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`btn-label -ml-px border border-rule-strong px-3.5 py-2.5 first:ml-0 ${
                filter === f.key
                  ? "bg-ink text-paper-white"
                  : "bg-transparent text-ink-soft hover:bg-paper-deep hover:text-ink"
              }`}
            >
              {f.label}
            </button>
          ))}
        </nav>

        <div className="flex flex-col">
          {shown.map((signal) => {
            const kind = KIND[signal.kind];
            const Icon = kind.icon;
            return (
              <article
                key={signal.id}
                className="flex gap-4 border-b border-rule px-6 py-5 hover:bg-paper-deep/60"
              >
                <span
                  className={`flex size-9 shrink-0 items-center justify-center rounded-sharp ${hueTint[kind.hue]}`}
                >
                  <Icon size={17} strokeWidth={1.75} className={hueText[kind.hue]} />
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                    <span className={`micro-label ${hueText[kind.hue]}`}>
                      {kind.label}
                    </span>
                    <span className="text-[13px] font-semibold">
                      {signal.companyName}
                    </span>
                    <span className="data-literal text-ink-mute">
                      {signal.domain}
                    </span>
                  </div>

                  <h2 className="mt-1.5 text-[15px] font-semibold leading-5">
                    {signal.headline}
                  </h2>
                  <p className="mt-1 max-w-[70ch] text-[13px] leading-5 text-ink-soft">
                    {signal.detail}
                  </p>
                  <p className="data-literal mt-2 text-ink-mute">
                    Detected {relativeTime(signal.detectedAt)} ago
                  </p>
                </div>

                <div className="flex shrink-0 flex-col items-end gap-2">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() =>
                      notify(`Outreach draft queued for ${signal.companyName}`)
                    }
                  >
                    Draft outreach
                    <ArrowUpRight size={13} strokeWidth={2} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      dismissSignal(signal.id);
                      notify(`Dismissed the ${signal.companyName} signal`);
                    }}
                  >
                    Dismiss
                  </Button>
                </div>
              </article>
            );
          })}

          {shown.length === 0 ? (
            <div className="p-6">
              <EmptyState
                title="Nothing here right now"
                body={
                  filter === "all"
                    ? "Every signal has been actioned. New ones land as your Dream 100 companies move."
                    : "No signals of this type. Switch back to All to see the rest."
                }
                action={
                  filter !== "all" ? (
                    <Button onClick={() => setFilter("all")}>
                      Show all signals
                    </Button>
                  ) : null
                }
              />
            </div>
          ) : null}
        </div>
      </div>

      <aside
        aria-label="Dream 100"
        className="flex w-80 shrink-0 flex-col border-l border-rule-strong bg-paper-white"
      >
        <div className="flex items-center justify-between border-b border-rule-strong px-4 py-3.5">
          <div>
            <p className="micro-label text-ink-mute">The list</p>
            <p className="display mt-1 text-[15px] leading-5">Dream 100</p>
          </div>
          <Button
            size="sm"
            onClick={() => notify("Company import is not wired up yet")}
          >
            <Plus size={13} strokeWidth={2.25} />
            Add
          </Button>
        </div>

        <div className="flex flex-col overflow-y-auto">
          {watched.map((company) => {
            const count = live.filter(
              (s) => s.dreamCompanyId === company.id,
            ).length;

            return (
              <button
                key={company.id}
                className="flex items-center gap-3 border-b border-rule px-4 py-3 text-left hover:bg-paper-deep"
              >
                <Avatar name={company.name} size="md" />

                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-[13px] font-semibold">
                      {company.name}
                    </span>
                    <span className="micro-label text-ink-mute">
                      T{company.tier}
                    </span>
                  </span>
                  <span className="data-literal block truncate text-ink-mute">
                    {company.industry}
                  </span>
                </span>

                <span className="flex shrink-0 items-center gap-1.5">
                  {company.lastSignalAt ? (
                    <PulseDot
                      freshness={freshnessFor(new Date(company.lastSignalAt), NOW)}
                    />
                  ) : null}
                  {count > 0 ? (
                    <span className="data-literal bg-vermilion px-1.5 text-paper-white">
                      {count}
                    </span>
                  ) : (
                    <span className="data-literal text-ink-mute">--</span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </aside>
    </main>
  );
}
