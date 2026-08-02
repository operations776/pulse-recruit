"use client";

import { Check } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { MatchScore } from "@/components/ui/match-score";
import { MetricRow } from "@/components/ui/metric-row";
import { Activity, freshnessFor } from "@/components/ui/pulse-dot";
import { NOW } from "@/lib/mock/seed";
import { useStore } from "@/lib/store";
import { relativeTime } from "@/lib/time";
import type { Candidate } from "@/lib/types";

export function CandidateCard({
  candidate,
  onOpen,
  onDragStart,
}: {
  candidate: Candidate;
  onOpen: () => void;
  onDragStart: () => void;
}) {
  const { selection, toggleSelected, metricsFor } = useStore();
  const selected = selection.includes(candidate.id);

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        onDragStart();
      }}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter") onOpen();
      }}
      role="button"
      tabIndex={0}
      aria-label={`Open ${candidate.name}`}
      className={`group relative cursor-pointer rounded-xl border bg-surface p-3 shadow-card transition-colors duration-150 ${
        selected
          ? "border-emerald-600 ring-1 ring-emerald-600"
          : "border-line hover:border-ink-400"
      }`}
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          toggleSelected(candidate.id);
        }}
        aria-label={selected ? `Deselect ${candidate.name}` : `Select ${candidate.name}`}
        aria-pressed={selected}
        className={`absolute right-3 top-3 flex size-4 items-center justify-center rounded-[5px] border ${
          selected
            ? "border-emerald-600 bg-emerald-600 text-white"
            : "border-line bg-surface opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
        }`}
      >
        {selected ? <Check size={11} strokeWidth={3} /> : null}
      </button>

      <div className="flex items-start gap-2.5 pr-6">
        <Avatar name={candidate.name} src={candidate.avatarUrl} size="lg" />
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold leading-[18px]">
            {candidate.name}
          </p>
          <p className="truncate text-[12px] leading-4 text-ink-600">
            {candidate.email}
          </p>
          <p className="data-literal truncate text-[12px] text-ink-400">
            {candidate.phone}
          </p>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 border-t border-line-soft pt-2.5">
        <MetricRow metrics={metricsFor(candidate.id)} />
        <span className="flex items-center gap-2.5">
          <Activity
            freshness={freshnessFor(new Date(candidate.lastActivityAt), NOW)}
            label={relativeTime(candidate.lastActivityAt)}
          />
          {candidate.match > 0 ? <MatchScore value={candidate.match} /> : null}
        </span>
      </div>
    </div>
  );
}
