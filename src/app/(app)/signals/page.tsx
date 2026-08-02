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

import { NOW } from "@/lib/mock/seed";
import { useStore } from "@/lib/store";
import { relativeTime } from "@/lib/time";
import type { SignalKind } from "@/lib/types";

// Each kind owns a fixed hue and icon so the eye learns them. Fixed, not
// hashed, so two kinds can never collide.
const KIND: Record<
  SignalKind,
  { label: string; icon: typeof Briefcase }
> = {
  funding: { label: "Funding", icon: Banknote },
  promotion: { label: "Promotion", icon: TrendingUp },
  open_role: { label: "Open role", icon: Briefcase },
  leadership: { label: "Leadership", icon: UserRoundCog },
  expansion: { label: "Expansion", icon: Globe2 },
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
        <header className="border-b border-rule px-6 py-5">
          <p className="legend text-vermilion">Dream 100 watchlist</p>
          <h1 className="display mt-2 text-[28px]">Signals</h1>
          <p className="mt-2 max-w-[62ch] text-[15px] text-ink-2">
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
                <dt className="legend text-ink-3">{label}</dt>
                <dd className="display text-[15px] leading-5">{value}</dd>
              </div>
            ))}
          </dl>
        </header>

        <nav className="flex flex-wrap items-center border-b border-rule">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`text-[15px] font-medium -ml-px border border-rule px-3.5 py-2.5 first:ml-0 ${
                filter === f.key
                  ? "bg-ink text-sheet"
                  : "bg-transparent text-ink-2 hover:bg-well hover:text-ink"
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
                className="flex gap-4 border-b border-rule px-6 py-5 hover:bg-well/60"
              >
                <span
                  className={`flex size-9 shrink-0 items-center justify-center rounded-control bg-well`}
                >
                  <Icon size={17} strokeWidth={1.75} className="text-ink-2" />
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                    <span className={`legend text-ink-2`}>
                      {kind.label}
                    </span>
                    <span className="text-[15px] font-semibold">
                      {signal.companyName}
                    </span>
                    <span className="meta text-ink-3">
                      {signal.domain}
                    </span>
                  </div>

                  <h2 className="mt-1.5 text-[15px] font-semibold leading-5">
                    {signal.headline}
                  </h2>
                  <p className="mt-1 max-w-[70ch] text-[15px] leading-5 text-ink-2">
                    {signal.detail}
                  </p>
                  <p className="meta mt-2 text-ink-3">
                    Detected {relativeTime(signal.detectedAt)} ago
                  </p>
                </div>

                <div className="flex shrink-0 flex-col items-end gap-2">
                  <Button
                    variant="primary"

                    onClick={() =>
                      notify(`Outreach draft queued for ${signal.companyName}`)
                    }
                  >
                    Draft outreach
                    <ArrowUpRight size={13} strokeWidth={2} />
                  </Button>
                  <Button
                    variant="ghost"

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
        className="flex w-80 shrink-0 flex-col border-l border-rule bg-sheet"
      >
        <div className="flex items-center justify-between border-b border-rule px-4 py-3.5">
          <div>
            <p className="legend text-ink-3">The list</p>
            <p className="display mt-1 text-[15px] leading-5">Dream 100</p>
          </div>
          <Button

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
                className="flex items-center gap-3 border-b border-rule px-4 py-3 text-left hover:bg-well"
              >
                <Avatar name={company.name} size="md" />

                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-[15px] font-semibold">
                      {company.name}
                    </span>
                    <span className="legend text-ink-3">
                      T{company.tier}
                    </span>
                  </span>
                  <span className="meta block truncate text-ink-3">
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
                    <span className="meta bg-vermilion px-1.5 text-sheet">
                      {count}
                    </span>
                  ) : (
                    <span className="meta text-ink-3">--</span>
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
