import { ChatPanel } from "@/components/ai/chat-panel";
import { getChat } from "@/lib/data";
import { hasResearchKey } from "@/lib/server/ai/exa";
import { hasModelKey } from "@/lib/server/ai/openai";
import { formatDate } from "@/lib/time";

// Pillar 1. The BD engine. The answer is only worth as much as the sources
// under it, so the panel always shows what it read, and a run that read nothing
// fails rather than answering (AI.md section 5).
const SUGGESTIONS = [
  "Which companies in my patch raised funding in the last 30 days?",
  "Who lost a talent lead recently?",
  "Which of my Dream 100 are hiring right now?",
];

export default async function MarketPage() {
  const { messages, credits } = await getChat("market");

  const allowance = credits?.weekly_allowance ?? 0;
  const used = credits?.used_this_week ?? 0;
  // Reserved credits belong to a run in flight. Showing them as available is
  // how you promise a question you cannot pay for.
  const reserved = credits?.reserved_this_week ?? 0;
  const available = Math.max(0, allowance - used - reserved);
  const committed = used + reserved;
  const usedPct =
    allowance > 0 ? Math.min(100, Math.round((committed / allowance) * 100)) : 0;
  const resetsAt = credits?.resets_at ?? null;

  const configured = hasModelKey() && hasResearchKey();

  return (
    <main className="flex min-w-0 flex-1 flex-col overflow-hidden bg-paper">
      <header className="border-b border-rule px-6 py-5">
        <p className="legend text-ink-3">Pillar 1 / offer productization</p>
        <h1 className="display mt-2 text-[18px]">BD engine</h1>
        <p className="mt-2 max-w-[62ch] text-[12px] text-ink-2">
          Ask what your market is doing. Every answer is built from live searches
          run while you watch, and it lists the pages it read so you can check
          the work.
        </p>
      </header>

      <div className="flex min-h-0 flex-1 flex-col p-6">
        <ChatPanel
          surface="market"
          messages={messages}
          available={available}
          weeklyAllowance={allowance}
          resetsAt={resetsAt ?? new Date().toISOString()}
          configured={configured}
          unconfiguredReason={
            hasModelKey()
              ? "Pulse has no research provider configured yet, so the BD engine cannot check anything. This is a Pulse setup step, not something you need to do."
              : "Pulse has no model configured yet, so the BD engine cannot answer. This is a Pulse setup step, not something you need to do."
          }
          placeholder="Ask about the companies you want to win"
          emptyTitle="Nothing asked yet"
          emptyBody="Ask about hiring, funding, or leadership moves at the companies you want to win. Every answer arrives with the pages it was built from."
          suggestions={SUGGESTIONS}
          headerRight={
            <div className="w-[220px] shrink-0">
              <p className="meta text-ink-2">
                {available} of {allowance} credits left this week
              </p>
              {/*
                DESIGN.md rule 5: vermilion is a verb. A meter is not clickable,
                so the fill is ink. Inset well, because it is a trough.
              */}
              <div
                aria-hidden
                className="well mt-1.5 h-1.5 overflow-hidden rounded-chip"
              >
                <div
                  className="h-full rounded-chip bg-ink"
                  style={{ width: `${usedPct}%` }}
                />
              </div>
              <p className="mt-1.5 text-[12px] text-ink-3">
                {reserved > 0
                  ? `${reserved} held by a question in flight`
                  : resetsAt
                    ? `Resets ${formatDate(resetsAt)}`
                    : "No allowance set"}
              </p>
            </div>
          }
        />
      </div>
    </main>
  );
}
