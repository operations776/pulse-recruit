"use client";

import { ChatPanel } from "@/components/ai/chat-panel";
import { useStore } from "@/lib/store";
import { formatDate } from "@/lib/time";

// Pillar 1. The BD engine. The answer is only worth as much as the sources
// under it, so the panel always shows what it read.
const SUGGESTIONS = [
  "Which companies in my patch raised funding in the last 30 days?",
  "Who lost a talent lead recently?",
  "Which of my Dream 100 are hiring right now?",
];

export default function MarketPage() {
  const { state, creditsLeft } = useStore();

  const left = creditsLeft();
  const allowance = state.credits.weeklyAllowance;
  const usedPct = allowance > 0 ? Math.min(100, Math.round((state.credits.usedThisWeek / allowance) * 100)) : 0;

  return (
    <main className="flex min-w-0 flex-1 flex-col overflow-hidden bg-paper">
      <header className="border-b border-rule px-6 py-5">
        <p className="legend text-ink-3">Pillar 1 / offer productization</p>
        <h1 className="display mt-2 text-[18px]">BD engine</h1>
        <p className="mt-2 max-w-[62ch] text-[12px] text-ink-2">
          Ask what your market is doing. Answers are built from live research and
          every source is listed, so you can check the work.
        </p>
      </header>

      <div className="flex min-h-0 flex-1 flex-col p-6">
        <ChatPanel
          surface="market"
          placeholder="Ask about the companies you want to win"
          emptyTitle="Nothing asked yet"
          emptyBody="Ask about hiring, funding, or leadership moves at the companies you want to win. Every answer arrives with the sources it was built from."
          suggestions={SUGGESTIONS}
          headerRight={
            <div className="w-[200px] shrink-0">
              <p className="meta text-ink-2">
                {left} of {allowance} credits left this week
              </p>
              {/*
                DESIGN.md rule 5: vermilion is a verb. A meter is not clickable,
                so the fill is ink. Inset well, because it is a trough.
              */}
              <div
                aria-hidden
                className="well mt-1.5 h-1.5 overflow-hidden rounded-chip bg-well"
              >
                <div
                  className="h-full rounded-chip bg-ink"
                  style={{ width: `${usedPct}%` }}
                />
              </div>
              <p className="mt-1.5 text-[12px] text-ink-3">
                Resets {formatDate(state.credits.resetsAt)}
              </p>
            </div>
          }
        />
      </div>
    </main>
  );
}
