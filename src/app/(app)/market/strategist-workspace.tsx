"use client";

import { Clock, Target } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { AgentState } from "@/components/ai/agent-status";
import { Briefing, parseBriefing } from "@/components/ai/briefing";
import { ChatPanel } from "@/components/ai/chat-panel";
import { phaseWord } from "@/components/ai/run-log";
import type { RunPhase } from "@/lib/ai-events";
import type {
  BDAgentMemoryRow,
  ChatConversationRow,
  ChatRow,
} from "@/lib/supabase/types";
import { formatDate } from "@/lib/time";
import { AnswerFeedback } from "./answer-feedback";
import { ConversationList } from "./conversation-list";
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
  conversations,
  activeConversationId,
  todayKey,
  yesterdayKey,
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
  conversations: ChatConversationRow[];
  activeConversationId: string | null;
  /** Fixed on the server so Today/Yesterday cannot disagree after hydration. */
  todayKey: string;
  yesterdayKey: string;
}) {
  const router = useRouter();

  // Lifted out of ChatPanel so the rail can say whether the strategist is
  // working. The panel owns the run; this is a read of it, not a second copy.
  const [running, setRunning] = useState<{
    busy: boolean;
    phase: RunPhase | null;
  }>({ busy: false, phase: null });

  // A missing platform key is a deployment fact the recruiter cannot fix, and
  // the composer already says so. The indicator agrees with it rather than
  // reporting Ready on a surface that cannot answer.
  const agentState: AgentState = !configured
    ? "unavailable"
    : running.busy
      ? "thinking"
      : "ready";

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

      {/* "Coaching it has taken" used to close this panel, showing the three
          most recent feedback records. The Context panel now holds all of
          them, with edit and delete on each, so repeating a truncated copy
          here would be the same fact stated twice in one column. */}
    </>
  );

  return (
    <main className="flex min-w-0 flex-1 overflow-hidden bg-paper">
      <StrategyRail
        memories={memories}
        canManageAgency={canManageAgency}
        meId={meId}
        meter={meter}
        agentState={agentState}
        agentDetail={
          running.phase ? phaseWord(running.phase, "market") : null
        }
        currentRead={currentRead}
        history={
          <ConversationList
            conversations={conversations}
            activeId={activeConversationId}
            meId={meId}
            todayKey={todayKey}
            yesterdayKey={yesterdayKey}
            onSelect={(id) => router.push(`/market?c=${id}`)}
            // No id at all: the next question starts a fresh thread, and the
            // transcript empties so it is obvious nothing is being continued.
            onNew={() => router.push("/market?c=new")}
          />
        }
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
          conversationId={activeConversationId}
          onRunStateChange={setRunning}
          // A first question creates its thread server-side, so the client
          // only learns the id when the run opens. Switching to it means a
          // reload lands on the conversation just started.
          onOpened={(id) => {
            if (id !== activeConversationId) router.replace(`/market?c=${id}`);
          }}
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
