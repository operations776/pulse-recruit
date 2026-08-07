"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useToast } from "@/components/ui/toast";
import { addCommitment } from "@/lib/actions";
import type { SignalRow } from "@/lib/supabase/types";

import { agent } from "@/config/brand";
/** A signal with its company resolved, which the row itself does not carry. */
export type PlaySignal = SignalRow & { companyName: string };

// PLS-112, aligned to the frame in PLS-185. "Today's play".
//
// One card, one move. The violet wash and the only filled button on the
// screen, which is the whole point: everything else on this page is
// information, this is the thing to actually do.
//
// The frame's two actions: "Draft the approach" fires the strategist at the
// outreach itself, and "Why this one" opens the reasoning in place rather
// than asking anyone to trust an unexplained recommendation. "Put it on my
// list" stays as the quiet third action because it is what feeds the ledger,
// and a play you cannot promise to run is advice, not coaching.
//
// The play is derived from the freshest undismissed signal rather than
// generated. A model call to decide what a recruiter should do today would
// spend credits on every page load, and AI.md is explicit that a paid call
// happens on an ask, not on a render. When there is no signal it says there
// is no signal, rather than inventing a play.

const KIND_WORD: Record<string, string> = {
  open_role: "an open-roles signal",
  funding: "a funding signal",
  leadership: "a leadership change",
  promotion: "a promotion signal",
  expansion: "an expansion signal",
};

export function TodaysPlay({ signal }: { signal: PlaySignal | null }) {
  const router = useRouter();
  const { notify } = useToast();
  const [pending, startTransition] = useTransition();
  const [taken, setTaken] = useState(false);
  const [whyOpen, setWhyOpen] = useState(false);

  if (!signal) {
    return (
      <section className="raised flex w-full flex-col gap-1.5 rounded-card border border-mara-rule bg-mara-sheet px-4 py-3.5">
        <p className="flex items-center gap-1.5 text-[12px] font-medium leading-[1.45] text-mara-violet-deep">
          <span aria-hidden className="size-1.5 rounded-full bg-mara-violet" />
          Today&rsquo;s play
        </p>
        <p className="text-[13px] leading-[1.5] text-mara-ink-2">
          Nothing has moved on your patch yet. Add companies to your Dream 100
          and {agent.name} will have something to point at here.
        </p>
      </section>
    );
  }

  // source_url is a link, not a provider name. The host is the honest thing
  // to show: "techcrunch.com" is checkable, "your patch" is not.
  let sourceHost: string | null = null;
  if (signal.source_url) {
    try {
      sourceHost = new URL(signal.source_url).hostname.replace(/^www\./, "");
    } catch {
      // A malformed url is not worth failing a render over.
    }
  }

  const commit = () => {
    startTransition(async () => {
      const result = await addCommitment(
        `Reach out to ${signal.companyName} about ${signal.headline.toLowerCase()}`,
        "play",
      );
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
      <p className="flex items-center gap-1.5 text-[12px] font-medium leading-[1.45] text-mara-violet-deep">
        <span aria-hidden className="size-1.5 rounded-full bg-mara-violet" />
        Today&rsquo;s play
      </p>

      {/* One paragraph, as the frame writes it: WHO first, then the fact and
          why it is yours. A play that does not name the company is a
          recommendation nobody can act on. */}
      <p className="text-[14px] leading-[1.5] text-mara-ink">
        <span className="font-medium">{signal.companyName}</span> ·{" "}
        {signal.headline}
        {signal.detail ? `. ${signal.detail}` : ""}
      </p>

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <button
          onClick={() =>
            router.push(
              `/market?q=${encodeURIComponent(`Draft my approach to ${signal.companyName}: ${signal.headline}. Use what you know about my agency.`)}`,
            )
          }
          className="settle rounded-control bg-mara-violet px-3 py-1.5 text-[12px] font-medium leading-[1.45] text-white hover:brightness-110"
        >
          Draft the approach
        </button>
        <button
          onClick={() => setWhyOpen((open) => !open)}
          aria-expanded={whyOpen}
          className="settle rounded-control border border-mara-rule bg-mara-sheet px-3 py-1.5 text-[12px] leading-[1.45] text-mara-ink-2 hover:border-mara-violet hover:text-mara-violet"
        >
          Why this one
        </button>
        <button
          onClick={commit}
          disabled={pending || taken}
          className="settle ml-auto text-[11px] leading-[1.45] text-mara-ink-3 underline-offset-2 hover:text-mara-violet hover:underline disabled:opacity-60 disabled:no-underline"
        >
          {taken ? "On your list" : pending ? "Saving" : "Put it on my list"}
        </button>
      </div>

      {whyOpen ? (
        // The reasoning is derived, so it says only derivable things: what
        // kind of signal, how fresh, and where it came from. No claim a table
        // cannot back.
        <div className="border-t border-mara-violet-edge pt-2 text-[12px] leading-[1.5] text-mara-ink-2">
          The freshest signal on your patch: {KIND_WORD[signal.kind] ?? "a signal"}{" "}
          at {signal.companyName}, picked up{" "}
          {new Date(signal.detected_at).toLocaleDateString("en-GB", {
            day: "numeric",
            month: "long",
          })}
          {sourceHost ? (
            <>
              {" "}
              from{" "}
              <a
                href={signal.source_url!}
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2 hover:text-mara-violet"
              >
                {sourceHost}
              </a>
            </>
          ) : null}
          . Companies move like this before they brief agencies, which is the
          window this card exists to catch.
        </div>
      ) : null}
    </section>
  );
}
