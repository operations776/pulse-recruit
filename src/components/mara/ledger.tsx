"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useToast } from "@/components/ui/toast";
import { settleCommitment } from "@/lib/actions";
import type { BDCommitmentRow } from "@/lib/supabase/types";

import { agent } from "@/config/brand";
// PLS-112. "You said you'd" — the commitments ledger.
//
// This is the part that makes Mara a coach. It is deliberately the second
// thing on the screen, above Today's play: what you already promised outranks
// a new suggestion, because an agent that only ever adds to your list is a
// worse colleague than one that closes things.
//
// The age label is amber from day three and stays amber. The Figma shows
// "SAID TUE / 3 DAYS" and "SAID 8 DAYS AGO" both in amber, which is the right
// call: a promise going stale is the signal, and escalating to red would put
// a broken promise in the same register as a failed publish.

function ageLabel(saidAt: string, nowMs: number): string {
  const days = Math.floor((nowMs - new Date(saidAt).getTime()) / 86_400_000);
  if (days <= 0) return "SAID TODAY";
  if (days === 1) return "SAID YESTERDAY";
  if (days < 7) {
    const weekday = new Date(saidAt)
      .toLocaleDateString("en-GB", { weekday: "short" })
      .toUpperCase();
    return `SAID ${weekday} / ${days} DAYS`;
  }
  return `SAID ${days} DAYS AGO`;
}

export function CommitmentsLedger({
  commitments,
  nowMs,
}: {
  commitments: BDCommitmentRow[];
  /** Fixed on the server so the age cannot disagree across hydration. */
  nowMs: number;
}) {
  const router = useRouter();
  const { notify } = useToast();
  const [pending, startTransition] = useTransition();
  const [settling, setSettling] = useState<string | null>(null);

  // PLS-139. The row leaves on the click, not on the server's answer.
  //
  // Crossing a promise off is the one emotional peak this product has, and it
  // used to be a router.refresh(): the row vanished after a round trip with no
  // acknowledgement, which is the same nothing a failed request gives you.
  //
  // The animation runs first and the write happens underneath it. If the write
  // fails the row springs back and the toast says why, so nothing is claimed
  // that did not happen.
  const markDone = (row: BDCommitmentRow) => {
    setSettling(row.id);
    startTransition(async () => {
      // NOT "went_well". Clicking Done means "take this off my list"; it does
      // not say the outreach landed. Writing went_well here put words in the
      // recruiter's mouth and contaminated the one column the debrief exists
      // to fill honestly.
      const result = await settleCommitment(row.id, "closed_by_user");
      if (!result.ok) {
        // Put it back. The promise is still open, and a row that left the
        // screen while still being owed is the product lying about the one
        // thing it exists to track.
        setSettling(null);
        notify(result.error, "danger");
        return;
      }
      notify(`Done. ${agent.name} has it off your list.`);
      // The refresh replaces this list with one that no longer holds the row,
      // so `settling` is deliberately NOT cleared on success: clearing it
      // would flash the full row back for one frame before the new data
      // arrives.
      router.refresh();
    });
  };

  return (
    <section className="flex w-full flex-col pb-0.5 pt-1">
      <div className="flex items-center justify-between pb-1.5">
        <p className="text-[13px] font-medium leading-[1.45] text-mara-ink">
          You said you&rsquo;d
        </p>
        {/* Drops with the row. A count still reading "1 OPEN" while the row
            it counts is visibly being crossed off is the header contradicting
            the list. */}
        <p className="meta text-mara-ink-3">
          {commitments.length - (settling ? 1 : 0)} OPEN
        </p>
      </div>

      {commitments.length === 0 ? (
        // Not an empty card. One honest line on the shared rule, because an
        // empty ledger is a good state and should not shout about itself.
        <p className="border-t border-mara-rule py-2.5 text-[12px] leading-[1.45] text-mara-ink-3">
          Nothing outstanding. {agent.name} logs a commitment when you say you will do
          something.
        </p>
      ) : (
        commitments.map((row) => (
          <div
            key={row.id}
            className={`flex items-center gap-[11px] border-t border-mara-rule py-2.5 ${
              settling === row.id ? "commitment-settled" : ""
            }`}
          >
            <span
              aria-hidden
              className={`settle size-[15px] shrink-0 rounded-full border-[1.5px] ${
                settling === row.id
                  ? "border-mara-violet bg-mara-violet"
                  : "border-mara-violet-edge"
              }`}
            />
            <p
              className={`min-w-0 flex-1 text-[13px] leading-[1.45] transition-colors duration-200 ${
                settling === row.id
                  ? "text-mara-ink-3 line-through"
                  : "text-mara-ink"
              }`}
            >
              {row.body}
            </p>
            <p className="meta shrink-0 text-mara-warn-deep">
              {ageLabel(row.said_at, nowMs)}
            </p>
            <button
              onClick={() => markDone(row)}
              disabled={pending}
              className="settle shrink-0 rounded-control border border-mara-rule bg-mara-sheet px-2.5 py-1 text-[11px] font-medium leading-[1.45] text-mara-ink-2 hover:border-mara-violet hover:text-mara-violet disabled:opacity-50"
            >
              {settling === row.id ? "Saving" : "Done"}
            </button>
          </div>
        ))
      )}
    </section>
  );
}
