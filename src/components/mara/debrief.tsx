"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useToast } from "@/components/ui/toast";
import { settleCommitment } from "@/lib/actions";
import type { BDCommitmentRow, BDDebriefOutcome } from "@/lib/supabase/types";

import { agent } from "@/config/brand";
// PLS-114. The evening debrief.
//
// From 17:00 London, Mara asks about the oldest open promise. This is the
// half of the coaching loop that makes the ledger mean anything: without it a
// commitment is a note you wrote to yourself, and the product is a to-do list
// with a face on it.
//
// Four answers, because "did you do it" with two answers makes a person lie.
// "Still chasing" deliberately leaves the commitment open, which is why the
// RPC maps it back to `open` rather than resolving it: chasing is a true
// state, and moving it out of the ledger would be the product telling a
// comfortable story about a promise that is still outstanding.

const OPTIONS: { outcome: BDDebriefOutcome; label: string; hint: string }[] = [
  { outcome: "went_well", label: "Did it", hint: "Off the list." },
  {
    outcome: "still_chasing",
    label: "Still chasing",
    hint: `Stays open. ${agent.pronoun} will ask again.`,
  },
  {
    outcome: "dead_end",
    label: "Dead end",
    hint: "Dropped, and he stops suggesting it.",
  },
  { outcome: "skipped", label: "Not today", hint: "Stays open, no judgement." },
];

export function DebriefCard({
  commitment,
}: {
  commitment: BDCommitmentRow | null;
}) {
  const router = useRouter();
  const { notify } = useToast();
  const [pending, startTransition] = useTransition();
  const [note, setNote] = useState("");
  const [dismissed, setDismissed] = useState(false);

  if (!commitment || dismissed) return null;

  const answer = (outcome: BDDebriefOutcome) => {
    startTransition(async () => {
      const result = await settleCommitment(commitment.id, outcome, note);
      if (!result.ok) {
        notify(result.error, "danger");
        return;
      }
      setDismissed(true);
      notify(
        outcome === "went_well"
          ? "Good. Off your list."
          : outcome === "dead_end"
            ? `Dropped. ${agent.pronoun} will stop bringing it up.`
            : `Noted. ${agent.pronoun} will ask again tomorrow.`,
      );
      router.refresh();
    });
  };

  return (
    <section className="mara-in relative flex w-full flex-col gap-2.5 overflow-hidden rounded-shell border border-mara-violet-edge bg-mara-violet-soft px-4 py-3.5">
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 w-[3px] bg-mara-violet"
      />

      <p className="meta text-mara-violet-deep">BEFORE YOU GO</p>
      {/* "This morning" was a guess. A promise made at 2pm is not a morning
          promise, and a card that gets the day wrong is a card you stop
          believing. "Earlier" is true at every hour the card can appear. */}
      <p className="text-[14px] leading-[1.45] text-mara-ink">
        Earlier you said you&rsquo;d{" "}
        <span className="font-medium">{commitment.body}</span>. How did it go?
      </p>

      <input
        value={note}
        onChange={(event) => setNote(event.target.value)}
        placeholder="Anything worth remembering? Optional."
        className="w-full rounded-control border border-mara-rule bg-mara-sheet px-3 py-1.5 text-[12px] leading-[1.45] text-mara-ink outline-none focus:border-mara-violet"
      />

      <div className="flex flex-wrap items-center gap-1.5">
        {OPTIONS.map((option) => (
          <button
            key={option.outcome}
            onClick={() => answer(option.outcome)}
            disabled={pending}
            title={option.hint}
            className={`settle rounded-control px-3 py-1.5 text-[12px] leading-[1.45] disabled:opacity-60 ${
              option.outcome === "went_well"
                ? "bg-mara-violet font-medium text-white hover:brightness-110"
                : "border border-mara-rule bg-mara-sheet text-mara-ink-2 hover:border-mara-violet hover:text-mara-violet"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </section>
  );
}
