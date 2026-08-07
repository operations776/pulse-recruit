"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { MaraAvatar } from "@/components/mara/avatar";
import { useToast } from "@/components/ui/toast";
import { settleCommitment } from "@/lib/actions";
import type { BDCommitmentRow, BDDebriefOutcome } from "@/lib/supabase/types";

import { agent } from "@/config/brand";
// PLS-114, aligned to the frame in PLS-185. The evening debrief.
//
// Fires at 5pm local, only on days with an open commitment. Two taps, then it
// closes. The answer becomes tomorrow's context. This is the half of the
// coaching loop that makes the ledger mean anything: without it a commitment
// is a note you wrote to yourself, and the product is a to-do list with a
// face on it.
//
// The frame draws it as a question spoken from the face on a quiet well, not
// a promotional violet card: the play card sells a move, this one just asks.
//
// Four answers, because "did you do it" with two answers makes a person lie.
// "Not yet, still chasing" deliberately leaves the commitment open, which is
// why the RPC maps it back to `open` rather than resolving it: chasing is a
// true state, and moving it out of the ledger would be the product telling a
// comfortable story about a promise that is still outstanding.

const OPTIONS: { outcome: BDDebriefOutcome; label: string; hint: string }[] = [
  { outcome: "went_well", label: "Went well", hint: "Off the list." },
  {
    outcome: "still_chasing",
    label: "Not yet, still chasing",
    hint: `Stays open. ${agent.name} will ask again.`,
  },
  {
    outcome: "dead_end",
    label: "Dead end",
    hint: `Dropped, and ${agent.pronoun} stops suggesting it.`,
  },
  { outcome: "skipped", label: "Skip", hint: "Stays open, no judgement." },
];

export function DebriefCard({
  commitment,
}: {
  commitment: BDCommitmentRow | null;
}) {
  const router = useRouter();
  const { notify } = useToast();
  const [pending, startTransition] = useTransition();
  const [dismissed, setDismissed] = useState(false);

  if (!commitment || dismissed) return null;

  const answer = (outcome: BDDebriefOutcome) => {
    startTransition(async () => {
      const result = await settleCommitment(commitment.id, outcome);
      if (!result.ok) {
        notify(result.error, "danger");
        return;
      }
      setDismissed(true);
      notify(
        outcome === "went_well"
          ? "Good. Off your list."
          : outcome === "dead_end"
            ? `Dropped. ${agent.name} will stop bringing it up.`
            : `Noted. ${agent.name} will ask again tomorrow.`,
      );
      router.refresh();
    });
  };

  return (
    <section className="mara-in flex w-full flex-col gap-2.5 rounded-card bg-mara-well px-4 py-3.5">
      <div className="flex items-start gap-2.5">
        <MaraAvatar state="idle" size={34} className="mt-px shrink-0" />
        {/* "Earlier", not "this morning": a promise made at 2pm is not a
            morning promise, and a card that gets the day wrong is a card you
            stop believing. */}
        <p className="min-w-0 self-center text-[14px] leading-[1.5] text-mara-ink">
          You said you&rsquo;d{" "}
          <span className="font-medium">{commitment.body}</span>. How did it
          land?
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 pl-[44px]">
        {OPTIONS.map((option) => (
          <button
            key={option.outcome}
            onClick={() => answer(option.outcome)}
            disabled={pending}
            title={option.hint}
            className={`settle rounded-control border border-mara-rule bg-mara-sheet px-3 py-1.5 text-[12px] leading-[1.45] disabled:opacity-60 ${
              option.outcome === "skipped"
                ? "text-mara-ink-3 hover:border-mara-violet hover:text-mara-violet"
                : "text-mara-ink hover:border-mara-violet hover:text-mara-violet"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </section>
  );
}
