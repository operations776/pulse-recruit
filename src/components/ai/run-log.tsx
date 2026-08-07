"use client";

import { AlertTriangle, Check, Globe, Table2 } from "lucide-react";
import type { RunPhase } from "@/lib/ai-events";
import type { ChatSurface } from "@/lib/supabase/types";

// The work log. This is the part that makes the engine legible: a recruiter
// watching it can see the searches being issued and decide whether the question
// was understood, instead of staring at a spinner for forty seconds.
//
// DESIGN.md rule 9 applies to every row here: colour plus icon plus word.

export type LogStep = { label: string; detail: string };

const PHASE_WORDS: Record<RunPhase, { market: string; ops: string }> = {
  reserving: { market: "Reserving credits", ops: "Reserving credits" },
  planning: { market: "Working out what to search", ops: "Working out what to check" },
  searching: { market: "Searching the web", ops: "Reading your pipeline" },
  reading: { market: "Reading pages", ops: "Reading your records" },
  checking: { market: "Checking sources", ops: "Reading your pipeline" },
  writing: { market: "Writing the answer", ops: "Writing the answer" },
  settling: { market: "Settling credits", ops: "Settling credits" },
};

/**
 * The phase in words, for a caller outside the transcript. PLS-110 shows it as
 * the title of the rail's status indicator, so both places name a phase the
 * same way rather than growing a second vocabulary for one run.
 */
export function phaseWord(phase: RunPhase, surface: ChatSurface) {
  return PHASE_WORDS[phase][surface];
}

export function RunLog({
  surface,
  phase,
  steps,
  done = false,
}: {
  surface: ChatSurface;
  phase: RunPhase;
  steps: LogStep[];
  done?: boolean;
}) {
  const word = PHASE_WORDS[phase][surface];
  const SourceIcon = surface === "market" ? Globe : Table2;

  return (
    <div className="rounded-card border border-rule bg-well/40">
      <div className="flex items-center gap-2 border-b border-rule px-3 py-2">
        {done ? (
          <Check size={16} strokeWidth={1.5} className="shrink-0 text-teal" />
        ) : (
          // The one ambient animation in the product, and it earns its place
          // here: it is the only thing telling you the run is still alive.
          <span
            aria-hidden
            className="pulse-dot-live inline-block size-1.5 shrink-0 rounded-full bg-teal"
          />
        )}
        <p className="legend text-ink-2">{done ? "Work done" : word}</p>
        <p className="meta ml-auto text-ink-3">
          {steps.length} {steps.length === 1 ? "step" : "steps"}
        </p>
      </div>

      {steps.length > 0 ? (
        <ul className="flex flex-col">
          {steps.map((step, i) => {
            const failed = step.label === "No result";
            const Icon = failed ? AlertTriangle : SourceIcon;
            return (
              <li
                key={`${step.label}-${step.detail}-${i}`}
                className="flex items-baseline gap-2.5 border-b border-rule px-3 py-1.5 last:border-b-0"
              >
                <Icon
                  size={16}
                  strokeWidth={1.5}
                  className={`shrink-0 translate-y-0.5 ${failed ? "text-amber" : "text-ink-3"}`}
                />
                <span
                  className={`legend shrink-0 ${failed ? "text-amber-text" : "text-ink-2"}`}
                >
                  {step.label}
                </span>
                <span className="min-w-0 flex-1 truncate text-[12px] text-ink-2">
                  {step.detail}
                </span>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
