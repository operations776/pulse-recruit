"use client";

import { Check } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { MatchScore } from "@/components/ui/match-score";
import { Activity, freshnessFor } from "@/components/ui/pulse-dot";
import type { CandidateRow } from "@/lib/supabase/types";
import { relativeTime } from "@/lib/time";

// DESIGN.md section 9, record card: sheet fill, 1px rule, --r-card, rounded
// square avatar, name at 13px/500, secondary line in ink-2, mono ID pinned to
// the footer.
//
// The activity counts that used to sit here are not loaded with the board, so
// the card shows only what the board query actually returns.
export function CandidateCard({
  candidate,
  selected,
  onToggle,
  onOpen,
  onDragStart,
}: {
  candidate: CandidateRow;
  selected: boolean;
  onToggle: () => void;
  onOpen: () => void;
  onDragStart: () => void;
}) {
  const now = new Date();

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
        selected ? "border-ink" : "border-rule hover:border-ink-3"
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Always visible, never hover revealed. 28px hit target. */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
          aria-label={
            selected ? `Deselect ${candidate.name}` : `Select ${candidate.name}`
          }
          aria-pressed={selected}
          className="-m-1 flex size-7 shrink-0 items-center justify-center rounded-control hover:bg-well"
        >
          <span
            className={`flex size-5 items-center justify-center rounded-chip border ${
              selected
                ? "border-ink bg-ink text-sheet"
                : "border-ink-3 bg-sheet"
            }`}
          >
            {selected ? <Check size={13} strokeWidth={3} /> : null}
          </span>
        </button>

        <Avatar name={candidate.name} size="md" />

        {/* The name gets the full remaining width. The record ID moves to the
            footer rather than competing with it on one 300px line. */}
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium leading-[1.3]">
            {candidate.name}
          </p>
          <p className="mt-1 truncate text-[12px] text-ink-2">
            {candidate.title || "Title not recorded"}
          </p>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 border-t border-rule pt-3">
        <span className="record-id text-ink-3">{candidate.ref}</span>
        <span className="flex items-center gap-4">
          <Activity
            freshness={freshnessFor(new Date(candidate.last_activity_at), now)}
            label={relativeTime(candidate.last_activity_at, now)}
          />
          {candidate.match > 0 ? (
            <MatchScore value={candidate.match} withLabel />
          ) : null}
        </span>
      </div>
    </div>
  );
}
