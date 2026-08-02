"use client";

import { Briefcase, Building2, TrendingUp, UserRoundCog } from "lucide-react";
import type { ComponentType } from "react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Breadcrumb, EmptyState } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { hueByIndex, hueText, hueTint, type Hue } from "@/lib/hue";
import { useStore } from "@/lib/store";
import { relativeTime } from "@/lib/time";
import type { Signal } from "@/lib/types";

type Kind = Signal["kind"];

// DESIGN.md: the identity hues categorize, they never decorate. The kind order
// here is fixed, so a funding signal is always the same hue in every session.
const KINDS: Kind[] = ["funding", "open_role", "leadership", "expansion"];

const ICONS: Record<Kind, ComponentType<{ size?: number; strokeWidth?: number }>> = {
  funding: TrendingUp,
  open_role: Briefcase,
  leadership: UserRoundCog,
  expansion: Building2,
};

const hueForKind = (kind: Kind): Hue => hueByIndex(KINDS.indexOf(kind));

const TABS: { label: string; kind: Kind | null }[] = [
  { label: "All", kind: null },
  { label: "Funding", kind: "funding" },
  { label: "Open roles", kind: "open_role" },
  { label: "Leadership", kind: "leadership" },
  { label: "Expansion", kind: "expansion" },
];

function SignalCard({
  signal,
  onDraft,
  onDismiss,
}: {
  signal: Signal;
  onDraft: () => void;
  onDismiss: () => void;
}) {
  const hue = hueForKind(signal.kind);
  const Icon = ICONS[signal.kind];

  return (
    <article className="flex items-start gap-3 rounded-2xl border border-line bg-surface p-4 shadow-card">
      <span
        aria-hidden
        className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${hueTint[hue]} ${hueText[hue]}`}
      >
        <Icon size={16} strokeWidth={1.5} />
      </span>

      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-semibold">{signal.headline}</p>

        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] leading-[18px]">
          <span className="font-medium text-ink-900">{signal.companyName}</span>
          <span className="data-literal text-ink-400">{signal.domain}</span>
        </p>

        <p className="mt-1.5 text-[13px] leading-[18px] text-ink-600">
          {signal.detail}
        </p>

        <p className="mt-2 flex items-center gap-1.5">
          <span className="micro-label text-ink-400">Detected</span>
          <span className="data-literal text-ink-400">
            {relativeTime(signal.detectedAt)}
          </span>
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        <Button variant="primary" size="sm" onClick={onDraft}>
          Draft outreach
        </Button>
        <Button variant="ghost" size="sm" onClick={onDismiss}>
          Dismiss
        </Button>
      </div>
    </article>
  );
}

export default function SignalsPage() {
  const { state, dismissSignal } = useStore();
  const { notify } = useToast();
  const [tab, setTab] = useState<(typeof TABS)[number]["label"]>("All");

  const active = TABS.find((t) => t.label === tab) ?? TABS[0];

  const live = state.signals.filter((s) => !s.dismissed);
  const shown = active.kind
    ? live.filter((s) => s.kind === active.kind)
    : live;

  return (
    <main className="flex min-w-0 flex-1 flex-col overflow-auto bg-canvas">
      <div className="px-6 pt-4">
        <Breadcrumb trail={["Recruitment", "Signals"]} />

        <div className="mt-2 flex items-center gap-2">
          <h1 className="font-display text-[22px] font-semibold leading-7 tracking-[-0.01em]">
            Signals
          </h1>
          <span className="data-literal rounded-full bg-line-soft px-2 text-ink-600">
            {live.length}
          </span>
        </div>

        <p className="mt-1.5 text-[13px] leading-[18px] text-ink-600">
          Buying signals detected across your market. Each one is a reason to
          reach out today.
        </p>

        <div className="mt-4 flex flex-wrap items-end gap-1 border-b border-line">
          {TABS.map((t) => (
            <button
              key={t.label}
              onClick={() => setTab(t.label)}
              className={`border-b-2 px-3 pb-2.5 text-[13px] ${
                tab === t.label
                  ? "border-emerald-600 font-semibold text-emerald-700"
                  : "border-transparent text-ink-600 hover:text-ink-900"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-6 pb-8 pt-4">
        <div className="flex max-w-[860px] flex-col gap-3">
          {shown.map((signal) => (
            <SignalCard
              key={signal.id}
              signal={signal}
              onDraft={() => notify("Outreach draft is not wired up yet")}
              onDismiss={() => {
                dismissSignal(signal.id);
                notify(`${signal.companyName} signal dismissed`);
              }}
            />
          ))}

          {shown.length === 0 ? (
            active.kind && live.length > 0 ? (
              <EmptyState
                title={`No live ${active.label.toLowerCase()} signals`}
                body="Other kinds are still live. Switch to All to see everything your market threw up today."
                action={
                  <Button variant="secondary" onClick={() => setTab("All")}>
                    Show all signals
                  </Button>
                }
              />
            ) : (
              <EmptyState
                title="Every signal is cleared"
                body="You dismissed the lot. Pulse keeps scanning your market, so new signals land here as they break."
              />
            )
          ) : null}
        </div>
      </div>
    </main>
  );
}
