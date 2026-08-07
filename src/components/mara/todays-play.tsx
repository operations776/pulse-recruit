"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useToast } from "@/components/ui/toast";
import { addCommitment } from "@/lib/actions";
import type { SignalRow } from "@/lib/supabase/types";

import { agent } from "@/config/brand";
/** A signal with its company resolved, which the row itself does not carry. */
export type PlaySignal = SignalRow & { companyName: string };

// PLS-112. "Today's play".
//
// One card, one move. The Figma gives it the violet left rule and the only
// filled button on the screen, which is the whole point: everything else on
// this page is information, this is the thing to actually do.
//
// The play is derived from the freshest undismissed signal rather than
// generated. A model call to decide what a recruiter should do today would
// spend credits on every page load, and AI.md is explicit that a paid call
// happens on an ask, not on a render. So the card reads the top signal and
// says plainly where it came from. When there is no signal it says there is no
// signal, rather than inventing a play.

export function TodaysPlay({ signal }: { signal: PlaySignal | null }) {
  const router = useRouter();
  const { notify } = useToast();
  const [pending, startTransition] = useTransition();
  const [taken, setTaken] = useState(false);

  if (!signal) {
    return (
      <section className="raised flex w-full flex-col gap-1.5 rounded-card border border-mara-rule bg-mara-sheet px-4 py-3.5">
        <p className="meta text-mara-ink-3">TODAY&rsquo;S PLAY</p>
        <p className="text-[13px] leading-[1.5] text-mara-ink-2">
          Nothing has moved on your patch yet. Add companies to your Dream 100
          and {agent.name} will have something to point at here.
        </p>
      </section>
    );
  }

  // The commitment is worded the way a recruiter would say it out loud, so it
  // reads correctly back in the ledger tomorrow morning.
  const body = `Reach out to ${signal.companyName} about ${signal.headline.toLowerCase()}`;

  // source_url is a link, not a provider name. The host is the honest thing
  // to show: "FROM TECHCRUNCH.COM" is checkable, "FROM YOUR PATCH" is not.
  let sourceLabel = "ON YOUR PATCH";
  if (signal.source_url) {
    try {
      sourceLabel = `FROM ${new URL(signal.source_url).hostname.replace(/^www\./, "").toUpperCase()}`;
    } catch {
      // A malformed url is not worth failing a render over.
    }
  }

  const commit = () => {
    startTransition(async () => {
      const result = await addCommitment(body, "play");
      if (!result.ok) {
        notify(result.error, "danger");
        return;
      }
      setTaken(true);
      notify(`Logged. ${agent.name} will ask you about it.`);
      router.refresh();
    });
  };

  return (
    <section className="raised flex w-full flex-col gap-2 rounded-card border border-mara-violet-edge bg-mara-violet-soft px-4 py-3.5">
            <div className="flex items-center justify-between">
        <p className="meta text-mara-violet-deep">TODAY&rsquo;S PLAY</p>
        <p className="meta text-mara-ink-3">{sourceLabel}</p>
      </div>

      <p className="text-[14px] font-medium leading-[1.45] text-mara-ink">
        {signal.headline}
      </p>
      {signal.detail ? (
        <p className="text-[12px] leading-[1.5] text-mara-ink-2">
          {signal.detail}
        </p>
      ) : null}

      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={commit}
          disabled={pending || taken}
          className="settle rounded-control bg-mara-violet px-3 py-1.5 text-[12px] font-medium leading-[1.45] text-white hover:brightness-110 disabled:opacity-60"
        >
          {taken ? "On your list" : pending ? "Saving" : "I'll do this"}
        </button>
        <button
          onClick={() =>
            router.push(
              `/market?q=${encodeURIComponent(`What should I say to ${signal.companyName} about ${signal.headline}?`)}`,
            )
          }
          className="settle rounded-control border border-mara-rule bg-mara-sheet px-3 py-1.5 text-[12px] leading-[1.45] text-mara-ink-2 hover:border-mara-violet hover:text-mara-violet"
        >
          Ask {agent.name} how
        </button>
      </div>
    </section>
  );
}
