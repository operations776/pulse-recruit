"use client";

import { Check } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { MatchScore } from "@/components/ui/match-score";
import { Activity, freshnessFor } from "@/components/ui/pulse-dot";
import { NOW } from "@/lib/mock/seed";
import { useStore } from "@/lib/store";
import { relativeTime } from "@/lib/time";
import type { Candidate } from "@/lib/types";

// DESIGN.md section 9, record card: sheet fill, 1px rule, --r-card, rounded
// square avatar, name 17px/500, secondary 15px in ink-2, mono ID top right.
export function CandidateCard({
  candidate,
  onOpen,
  onDragStart,
}: {
  candidate: Candidate;
  onOpen: () => void;
  onDragStart: () => void;
}) {
  const { selection, toggleSelected } = useStore();
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
      className={`relative cursor-pointer rounded-card border bg-sheet p-4 ${
        selected ? "border-vermilion" : "border-rule hover:border-ink-3"
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Always visible, never hover revealed. 44px hit target. */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            toggleSelected(candidate.id);
          }}
          aria-label={selected ? `Deselect ${candidate.name}` : `Select ${candidate.name}`}
          aria-pressed={selected}
          className="-m-1.5 flex size-11 shrink-0 items-center justify-center rounded-control hover:bg-well"
        >
          <span
            className={`flex size-5 items-center justify-center rounded-chip border ${
              selected
                ? "border-vermilion bg-vermilion text-on-vermilion"
                : "border-ink-3 bg-sheet"
            }`}
          >
            {selected ? <Check size={13} strokeWidth={3} /> : null}
          </span>
        </button>

        <Avatar name={candidate.name} src={candidate.avatarUrl} size="md" />

        {/* The name gets the full remaining width. The record ID moves to the
            footer rather than competing with it on one 300px line. */}
        <div className="min-w-0 flex-1">
          <p className="text-[17px] font-medium leading-[1.3]">
            {candidate.name}
          </p>
          <p className="mt-1 truncate text-[15px] text-ink-2">
            {candidate.title}
          </p>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 border-t border-rule pt-3">
        <span className="record-id text-ink-3">{candidate.ref}</span>
        <span className="flex items-center gap-4">
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
