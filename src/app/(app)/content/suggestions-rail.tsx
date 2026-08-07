"use client";

import { Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Chip, MonoLabel } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { dismissSuggestion, draftFromSuggestion } from "@/lib/actions";
import type {
  SuggestionDismissReason,
  SuggestionRow,
} from "@/lib/supabase/types";

// PLS-182. "Worth posting about".
//
// The engine, its schema and its two RPCs shipped in PLS-161 and PLS-162 with
// no reader anywhere in src/. This is the UI that finally uses them.
//
// THE GROUNDING IS THE WHOLE POINT, so it is on screen rather than implied.
// Every suggestion names the row it came from, because the engine drops
// anything naming a ref it was not shown. "Post about the VP Eng role at
// Northstar, opened Tuesday" is checkable; "share a thought leadership piece"
// is the slop this product exists to not produce.

const SOURCE_WORD: Record<SuggestionRow["source_kind"], string> = {
  job: "From a role",
  candidacy: "From a candidate",
  placement: "From a placement",
  company: "From a company",
  signal: "From a signal",
  lesson: "From your edits",
};

// The reason is the payload, not a formality: dismiss_suggestion reads it back
// with different strengths. "Not my patch" suppresses that source hard; "not
// now" only snoozes for a fortnight and suppresses nothing.
const REASONS: { key: SuggestionDismissReason; label: string }[] = [
  { key: "not_my_patch", label: "Not my patch" },
  { key: "too_salesy", label: "Too salesy" },
  { key: "already_covered", label: "Already covered" },
  { key: "wrong_skill", label: "Wrong format" },
  { key: "not_now", label: "Not now" },
];

export function SuggestionsRail({
  suggestions,
}: {
  suggestions: SuggestionRow[];
}) {
  const router = useRouter();
  const { notify } = useToast();
  const [pending, startTransition] = useTransition();
  const [askingWhy, setAskingWhy] = useState<string | null>(null);

  if (suggestions.length === 0) {
    return (
      <section className="flex flex-col gap-2">
        <p className="text-[13px] font-medium leading-[1.45] text-ink">
          Worth posting about
        </p>
        {/* A workspace with nothing new produces zero suggestions and says so.
            It does not produce a generic "post about your expertise", which is
            the fabrication rule broken on the most persuasive surface. */}
        <p className="text-[12px] leading-[1.5] text-ink-3">
          Nothing new on your patch yet. Suggestions come from your own roles,
          placements and signals, so they appear once something moves.
        </p>
      </section>
    );
  }

  const draft = (row: SuggestionRow) => {
    startTransition(async () => {
      const result = await draftFromSuggestion(row.id, row.title);
      if (!result.ok) {
        notify(result.error, "danger");
        return;
      }
      notify("Drafted. It is in your planner.");
      router.refresh();
    });
  };

  const dismiss = (row: SuggestionRow, reason: SuggestionDismissReason) => {
    setAskingWhy(null);
    startTransition(async () => {
      const result = await dismissSuggestion(row.id, reason);
      if (!result.ok) {
        notify(result.error, "danger");
        return;
      }
      notify(
        reason === "not_now"
          ? "Parked. It will come back in a fortnight."
          : "Noted. Fewer like that one.",
      );
      router.refresh();
    });
  };

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-[13px] font-medium leading-[1.45] text-ink">
          <Sparkles size={14} strokeWidth={1.75} aria-hidden />
          Worth posting about
        </p>
        <MonoLabel>{suggestions.length} open</MonoLabel>
      </div>

      {suggestions.map((row) => (
        <article
          key={row.id}
          className="raised flex flex-col gap-2 rounded-card border border-rule bg-sheet px-3.5 py-3"
        >
          <div className="flex items-start justify-between gap-2">
            <p className="text-[13px] leading-[1.45] text-ink">{row.title}</p>
            <Chip variant="state" tone="neutral">
              {SOURCE_WORD[row.source_kind]}
            </Chip>
          </div>

          {/* Why it was suggested, always. An unexplained suggestion is one
              users learn to ignore. */}
          <p className="text-[12px] leading-[1.5] text-ink-2">{row.why}</p>

          {askingWhy === row.id ? (
            <div className="flex flex-wrap items-center gap-1.5 border-t border-rule pt-2">
              <MonoLabel>Why not?</MonoLabel>
              {REASONS.map((reason) => (
                <button
                  key={reason.key}
                  onClick={() => dismiss(row, reason.key)}
                  disabled={pending}
                  className="settle rounded-chip border border-rule bg-sheet px-2.5 py-1 text-[11px] leading-[1.45] text-ink-2 hover:border-violet hover:text-violet disabled:opacity-50"
                >
                  {reason.label}
                </button>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => draft(row)}
                disabled={pending}
                className="cap settle rounded-control bg-violet px-3 py-1.5 text-[12px] font-medium leading-[1.45] text-on-violet [--edge:var(--color-violet-edge)] hover:bg-violet-hover disabled:opacity-60"
              >
                Draft it
              </button>
              <button
                onClick={() => setAskingWhy(row.id)}
                disabled={pending}
                className="settle rounded-control border border-rule bg-sheet px-3 py-1.5 text-[12px] leading-[1.45] text-ink-2 hover:border-violet hover:text-violet disabled:opacity-50"
              >
                Not for me
              </button>
            </div>
          )}
        </article>
      ))}
    </section>
  );
}
