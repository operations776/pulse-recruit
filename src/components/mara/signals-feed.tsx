// PLS-112. "What moved on your patch".
//
// Reads the signals table, which already exists and already carries kind,
// headline, detail and a detected_at. The Figma's right-hand label (ACT NOW /
// RECOVER / WATCH) is a judgement about urgency, so it is derived from the
// signal kind rather than stored: a funding round or a new open role is
// actionable now, a client who hired without you is a recovery, everything
// else is worth watching.

import type { SignalRow } from "@/lib/supabase/types";

import { agent } from "@/config/brand";
const URGENCY: Record<string, { label: string; tone: string }> = {
  open_role: { label: "ACT NOW", tone: "bg-mara-violet" },
  funding: { label: "WATCH", tone: "bg-mara-good" },
  leadership: { label: "RECOVER", tone: "bg-mara-warn" },
  promotion: { label: "ACT NOW", tone: "bg-mara-violet" },
  expansion: { label: "WATCH", tone: "bg-mara-good" },
};

export function SignalsFeed({ signals }: { signals: SignalRow[] }) {
  return (
    <section className="flex w-full flex-col pt-2.5">
      <div className="flex items-center justify-between pb-2">
        <p className="text-[13px] font-medium leading-[1.45] text-mara-ink">
          What moved on your patch
        </p>
        <p className="meta text-mara-ink-3">Last 7 days</p>
      </div>

      {signals.length === 0 ? (
        <p className="border-t border-mara-rule py-2.5 text-[12px] leading-[1.45] text-mara-ink-3">
          Nothing yet. Add companies to your Dream 100 and {agent.name} watches them
          for funding, hiring and leadership moves.
        </p>
      ) : (
        signals.map((signal) => {
          const urgency = URGENCY[signal.kind] ?? {
            label: "WATCH",
            tone: "bg-mara-ink-3",
          };

          return (
            <div
              key={signal.id}
              className="flex items-center gap-3 border-t border-mara-rule py-2.5"
            >
              <span
                aria-hidden
                className={`size-[7px] shrink-0 rounded-full ${urgency.tone}`}
              />
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] leading-[1.45] text-mara-ink">
                  {signal.headline}
                </span>
                <span className="block text-[11px] leading-[1.45] text-mara-ink-3">
                  {signal.detail}
                </span>
              </span>
              {/* Colour plus word, never colour alone: the dot repeats what
                  this label already says. */}
              <span className="meta shrink-0 tracking-[0.4px] text-mara-ink-2">
                {urgency.label}
              </span>
            </div>
          );
        })
      )}
    </section>
  );
}
