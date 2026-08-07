"use client";

import {
  ArrowUpRight,
  Banknote,
  Briefcase,
  Globe2,
  Plus,
  TrendingUp,
  UserRoundCog,
  type LucideIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import { PulseDot, freshnessFor } from "@/components/ui/pulse-dot";
import { useToast } from "@/components/ui/toast";
import { dismissSignal } from "@/lib/actions";
import type { DreamCompanyRow, SignalRow } from "@/lib/supabase/types";
import { relativeTime } from "@/lib/time";

// Each kind owns a fixed icon so the eye learns them. Fixed, not hashed, so two
// kinds can never collide.
const KIND: Record<SignalRow["kind"], { label: string; icon: LucideIcon }> = {
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

export function SignalFeed({
  signals,
  dreamCompanies,
  now,
}: {
  signals: SignalRow[];
  dreamCompanies: DreamCompanyRow[];
  now: string;
}) {
  const router = useRouter();
  const { notify } = useToast();
  const [pending, startTransition] = useTransition();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("all");

  const clock = useMemo(() => new Date(now), [now]);

  // The query already excludes dismissed rows, so everything here is live.
  const companyById = useMemo(
    () => new Map(dreamCompanies.map((c) => [c.id, c])),
    [dreamCompanies],
  );

  const shown =
    filter === "all" ? signals : signals.filter((s) => s.kind === filter);

  const moving = new Set(signals.map((s) => s.dream_company_id)).size;

  const dismiss = (signal: SignalRow, companyName: string) => {
    startTransition(async () => {
      const result = await dismissSignal(signal.id);
      if (!result.ok) {
        notify(
          `${result.error} The ${companyName} signal is still here.`,
          "danger",
        );
        return;
      }
      notify(`Dismissed the ${companyName} signal`);
      router.refresh();
    });
  };

  return (
    <main className="flex min-w-0 flex-1 overflow-hidden bg-paper">
      <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
        <header className="border-b border-rule px-6 py-5">
          <p className="legend text-ink-3">Dream 100 watchlist</p>
          <h1 className="display mt-2 text-[18px]">Signals</h1>
          <p className="mt-2 max-w-[62ch] text-[12px] text-ink-2">
            What the companies you are chasing did this week. Every signal is a
            reason to call someone today.
          </p>

          <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-2">
            {[
              ["Companies watched", String(dreamCompanies.length)],
              ["Live signals", String(signals.length)],
              ["Companies moving", `${moving}/${dreamCompanies.length}`],
            ].map(([label, value]) => (
              <div key={label} className="flex items-baseline gap-2">
                <dt className="legend text-ink-3">{label}</dt>
                <dd className="display text-[12px] leading-5">{value}</dd>
              </div>
            ))}
          </dl>
        </header>

        <nav className="flex flex-wrap items-center border-b border-rule">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`-ml-px border border-rule px-3.5 py-2.5 text-[12px] font-medium first:ml-0 ${
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
            const company = companyById.get(signal.dream_company_id);
            const companyName = company?.name ?? "This company";

            return (
              <article
                key={signal.id}
                className="flex gap-4 border-b border-rule px-6 py-5"
              >
                <span className="well flex size-9 shrink-0 items-center justify-center rounded-control">
                  <Icon size={17} strokeWidth={1.75} className="text-ink-2" />
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                    <span className="legend text-ink-2">{kind.label}</span>
                    <span className="text-[12px] font-medium">
                      {companyName}
                    </span>
                    {company ? (
                      <span className="meta text-ink-3">{company.domain}</span>
                    ) : null}
                  </div>

                  <h2 className="mt-1.5 text-[12px] font-medium leading-5">
                    {signal.headline}
                  </h2>
                  <p className="mt-1 max-w-[70ch] text-[12px] leading-5 text-ink-2">
                    {signal.detail}
                  </p>
                  <p className="meta mt-2 text-ink-3">
                    Detected {relativeTime(signal.detected_at, clock)} ago
                  </p>
                </div>

                <div className="flex shrink-0 flex-col items-end gap-2">
                  {/*
                    Drafting is not connected yet, so the copy says exactly that
                    rather than claiming a draft was queued. A state change that
                    did not happen must never read as one.
                  */}
                  <Button
                    onClick={() =>
                      notify(
                        `Outreach drafting is not connected yet, so nothing was queued for ${companyName}.`,
                      )
                    }
                  >
                    Draft outreach
                    <ArrowUpRight size={13} strokeWidth={2} />
                  </Button>
                  <Button
                    variant="ghost"
                    disabled={pending}
                    onClick={() => dismiss(signal, companyName)}
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
            <p className="display mt-1 text-[12px] leading-5">Dream 100</p>
          </div>
          <Button
            onClick={() =>
              notify("Company import is not connected yet, so nothing was added.")
            }
          >
            <Plus size={13} strokeWidth={2.25} />
            Add
          </Button>
        </div>

        <div className="flex flex-col overflow-y-auto">
          {dreamCompanies.map((company) => {
            const count = signals.filter(
              (s) => s.dream_company_id === company.id,
            ).length;

            return (
              <div
                key={company.id}
                className="flex items-center gap-3 border-b border-rule px-4 py-3 text-left"
              >
                <Avatar name={company.name} size="md" />

                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-[12px] font-medium">
                      {company.name}
                    </span>
                    <span className="legend text-ink-3">T{company.tier}</span>
                  </span>
                  <span className="meta block truncate text-ink-3">
                    {company.industry}
                  </span>
                </span>

                <span className="flex shrink-0 items-center gap-1.5">
                  {company.last_signal_at ? (
                    <PulseDot
                      freshness={freshnessFor(
                        new Date(company.last_signal_at),
                        clock,
                      )}
                    />
                  ) : null}
                  {count > 0 ? (
                    <span className="meta rounded-chip bg-ink px-1.5 text-sheet">
                      {count}
                    </span>
                  ) : (
                    <span className="meta text-ink-3">--</span>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      </aside>
    </main>
  );
}
