"use client";

import { Clock, Compass, Target } from "lucide-react";
import { useMemo } from "react";
import { Briefing, parseBriefing } from "@/components/ai/briefing";
import { ChatPanel } from "@/components/ai/chat-panel";
import type { BDAgentMemoryRow, ChatRow } from "@/lib/supabase/types";
import { formatDate } from "@/lib/time";
import { AnswerFeedback } from "./answer-feedback";
import { StrategyRail } from "./strategy-rail";

// PLS-98. The workspace.
//
// Two columns, not three. The working brief on the left runs top to bottom
// from what the strategist knows to what it last found; the briefing takes
// everything else. An earlier build had a third evidence column on the right,
// which at 1440px made four vertical strips counting the module rail, and gave
// the transcript, the only part anyone actually reads, the least width of the
// lot.
//
// Everything on this screen is either something the recruiter told it or
// something it researched. There is no third category, and nothing here
// invents a persona.

const SUGGESTIONS = [
  "Which companies in my patch raised funding in the last 30 days?",
  "Who lost a talent lead recently and has not replaced them?",
  "Which of my Dream 100 are hiring right now?",
  "Which accounts have gone quiet that I should re-open?",
];

export function StrategistWorkspace({
  messages,
  memories,
  feedbackByAnswer,
  canManageAgency,
  meId,
  available,
  allowance,
  reserved,
  resetsAt,
  usedPct,
  configured,
  unconfiguredReason,
}: {
  messages: ChatRow[];
  memories: BDAgentMemoryRow[];
  /** answer id to the rating this recruiter already gave it. */
  feedbackByAnswer: Record<string, "useful" | "off_target">;
  canManageAgency: boolean;
  meId: string;
  available: number;
  allowance: number;
  reserved: number;
  resetsAt: string | null;
  usedPct: number;
  configured: boolean;
  unconfiguredReason: string;
}) {
  const answers = useMemo(
    () => messages.filter((m) => m.role === "assistant" && m.status === "complete"),
    [messages],
  );

  const latest = answers[answers.length - 1] ?? null;

  // The current recommendation, lifted out of the last briefing. This is the
  // one line a recruiter came to the page for, so it is readable without
  // scrolling back through the transcript.
  const nextMove = useMemo(() => {
    if (!latest) return null;
    const sections = parseBriefing(latest.body);
    return sections?.find((section) => section.key === "move")?.body ?? null;
  }, [latest]);

  // How current the evidence actually is. A cache hit is honest research but
  // it is not a live look-up, and a recruiter about to call a client needs to
  // know which one they have.
  const freshness = useMemo(() => {
    if (!latest) return null;
    const meta = (latest.meta ?? {}) as Record<string, unknown>;
    const searches = typeof meta.searches === "number" ? meta.searches : 0;
    const reads = typeof meta.page_reads === "number" ? meta.page_reads : 0;
    if (searches > 0 || reads > 0) return "Live research";
    // Nothing was fetched, so everything under this answer came from the
    // agency's recent research rather than a call made just now.
    return "Recent research";
  }, [latest]);

  const coaching = useMemo(
    () => memories.filter((memory) => memory.source === "feedback").slice(0, 3),
    [memories],
  );

  const meter = (
    <div>
      <p className="meta text-ink-2">
        {available} of {allowance} credits left this week
      </p>
      {/* DESIGN.md rule 5: a meter is not clickable, so the fill is ink. */}
      <div aria-hidden className="well mt-1.5 h-1.5 overflow-hidden rounded-chip">
        <div
          className="settle h-full rounded-chip bg-ink"
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
  );

  const currentRead = (
    <>
      <section className="border-t border-rule px-4 py-3">
        <p className="legend flex items-center gap-1.5 text-[#8a4380]">
          <Target size={16} strokeWidth={1.75} className="size-3.5" aria-hidden />
          Best next move
        </p>
        <p className="mt-1.5 text-[12px] leading-[1.5] text-ink">
          {nextMove ??
            "Ask a question and the strategist will name one, with the evidence behind it."}
        </p>
      </section>

      <section className="border-t border-rule px-4 py-3">
        <p className="legend flex items-center gap-1.5 text-ink-3">
          <Clock size={16} strokeWidth={1.5} className="size-3.5" aria-hidden />
          Evidence
        </p>
        <p className="mt-1.5 text-[12px] leading-[1.5] text-ink-2">
          {latest
            ? `${freshness}, ${formatDate(latest.created_at)}`
            : "Nothing researched yet."}
        </p>
        {latest && Array.isArray(latest.sources) && latest.sources.length > 0 ? (
          <p className="meta mt-1 text-ink-3">
            {latest.sources.length}{" "}
            {latest.sources.length === 1 ? "source" : "sources"}
          </p>
        ) : null}
      </section>

      {coaching.length > 0 ? (
        <section className="border-t border-rule px-4 py-3">
          <p className="legend flex items-center gap-1.5 text-ink-3">
            <Compass size={16} strokeWidth={1.5} className="size-3.5" aria-hidden />
            Coaching it has taken
          </p>
          <ul className="mt-1.5 flex flex-col gap-2">
            {coaching.map((memory) => (
              <li key={memory.id} className="text-[12px] leading-[1.5] text-ink-2">
                <span className="line-clamp-3">{memory.body}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );

  return (
    <main className="flex min-w-0 flex-1 overflow-hidden bg-paper">
      <StrategyRail
        memories={memories}
        canManageAgency={canManageAgency}
        meId={meId}
        meter={meter}
        currentRead={currentRead}
      />

      <div className="layer-rise flex min-w-0 flex-1 flex-col overflow-hidden">
        <ChatPanel
          surface="market"
          messages={messages}
          available={available}
          weeklyAllowance={allowance}
          resetsAt={resetsAt ?? new Date().toISOString()}
          configured={configured}
          unconfiguredReason={unconfiguredReason}
          placeholder="Ask about the companies you want to win"
          emptyTitle="Nothing researched yet"
          emptyBody="Ask about hiring, funding, or leadership moves at the companies you want to win. Every answer names the opportunity, why it matters to you, and the one move worth making, with the sources it was built from."
          suggestions={SUGGESTIONS}
          renderAnswer={(message) => {
            const sections = parseBriefing(message.body);
            // No labels means the model answered in prose, usually because the
            // research was too thin for a recommendation. Show exactly what it
            // wrote rather than forcing it into a shape it does not fit.
            if (!sections) {
              return (
                <p className="whitespace-pre-line text-[13px] leading-[1.5]">
                  {message.body}
                </p>
              );
            }
            return <Briefing sections={sections} />;
          }}
          answerFooter={(message) =>
            message.status === "complete" ? (
              <AnswerFeedback
                answerId={message.id}
                existing={feedbackByAnswer[message.id] ?? null}
              />
            ) : null
          }
        />
      </div>

    </main>
  );
}
