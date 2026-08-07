"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Briefing, parseBriefing } from "@/components/ai/briefing";
import { ChatPanel } from "@/components/ai/chat-panel";
import type { MaraState } from "@/components/mara/avatar";
import { CommitmentsLedger } from "@/components/mara/ledger";
import { MetricsStrip, type Metric } from "@/components/mara/metrics";
import { PersonaPanel, type Domain } from "@/components/mara/persona-panel";
import { SignalsFeed } from "@/components/mara/signals-feed";
import { TellMaraDrawer } from "@/components/mara/tell-mara";
import { TodaysPlay, type PlaySignal } from "@/components/mara/todays-play";
import type {
  BDAgentMemoryRow,
  BDCommitmentRow,
  ChatConversationRow,
  ChatRow,
} from "@/lib/supabase/types";
import { AnswerFeedback } from "@/app/(app)/market/answer-feedback";

// PLS-112. Mara's screen.
//
// Two columns: the stage and the persona panel. The stage runs greeting,
// ledger, play, metrics, signals, then the conversation. That order is the
// argument the Figma is making, and it is worth stating: what you promised
// comes before what Mara suggests, and both come before the numbers. An agent
// that opens with metrics is a dashboard. This one opens with a person asking
// whether you did the thing you said you would do.
//
// Once a conversation is running the briefing is what matters, so everything
// above it collapses out of the way rather than pushing the transcript off the
// bottom of the screen.

const SUGGESTIONS = [
  "Which companies in my patch raised funding in the last 30 days?",
  "Who lost a talent lead recently and has not replaced them?",
  "Which of my Dream 100 are hiring right now?",
  "Which accounts have gone quiet that I should re-open?",
];

/** Morning, afternoon or evening, decided on the server. */
function greetingFor(hour: number): string {
  if (hour < 12) return "Morning";
  if (hour < 18) return "Afternoon";
  return "Evening";
}

export function MaraStage({
  messages,
  memories,
  feedbackByAnswer,
  commitments,
  signals,
  metrics,
  domains,
  firstName,
  serverHour,
  nowMs,
  lastRead,
  canManageAgency,
  meId,
  available,
  allowance,
  resetsAt,
  configured,
  unconfiguredReason,
  activeConversationId,
}: {
  messages: ChatRow[];
  memories: BDAgentMemoryRow[];
  feedbackByAnswer: Record<string, "useful" | "off_target">;
  commitments: BDCommitmentRow[];
  signals: PlaySignal[];
  metrics: Metric[];
  domains: Domain[];
  firstName: string;
  /** London hour, resolved server-side so the greeting cannot flip on hydration. */
  serverHour: number;
  nowMs: number;
  lastRead: string;
  canManageAgency: boolean;
  meId: string;
  available: number;
  allowance: number;
  resetsAt: string | null;
  configured: boolean;
  unconfiguredReason: string;
  conversations: ChatConversationRow[];
  activeConversationId: string | null;
}) {
  const router = useRouter();
  const [tellOpen, setTellOpen] = useState(false);

  // A run in flight is the only thing that should animate the avatar. Anything
  // else would be a mood with no cause behind it.
  const state: MaraState = useMemo(() => {
    const last = messages[messages.length - 1];
    if (last?.status === "running") return "thinking";
    if (last?.role === "assistant" && last.status === "complete")
      return "speaking";
    return "idle";
  }, [messages]);

  // The briefing owns the screen once there is one. Below this threshold the
  // stage is the page; above it the stage is a header.
  const started = messages.length > 0;

  return (
    <main className="flex min-w-0 flex-1 overflow-hidden bg-mara-ground">
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <div
          className={
            started
              ? // Collapsed. The ledger stays because an open promise is the
                // one thing worth interrupting a conversation for.
                "shrink-0 overflow-y-auto border-b border-mara-rule px-7 pb-3 pt-4"
              : "flex-1 overflow-y-auto px-7 pb-4 pt-7"
          }
        >
          <div className="mx-auto flex w-full max-w-[720px] flex-col gap-3">
            {!started ? (
              <div className="mara-in flex flex-col gap-1">
                <h1 className="text-[22px] font-medium leading-[1.35] tracking-[-0.4px] text-mara-ink">
                  {greetingFor(serverHour)}, {firstName}.
                </h1>
                <p className="text-[13px] leading-[1.5] text-mara-ink-2">
                  {commitments.length > 0
                    ? `You have ${commitments.length} open ${commitments.length === 1 ? "promise" : "promises"}. Let's start there.`
                    : "Nothing outstanding. Ask me about the companies you want to win."}
                </p>
              </div>
            ) : null}

            <div className="mara-in mara-in-1">
              <CommitmentsLedger commitments={commitments} nowMs={nowMs} />
            </div>

            {!started ? (
              <>
                <div className="mara-in mara-in-2">
                  <TodaysPlay signal={signals[0] ?? null} />
                </div>
                <div className="mara-in mara-in-3">
                  <MetricsStrip metrics={metrics} />
                </div>
                <div className="mara-in mara-in-3">
                  <SignalsFeed signals={signals} />
                </div>
              </>
            ) : null}
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <ChatPanel
            surface="market"
            messages={messages}
            available={available}
            weeklyAllowance={allowance}
            resetsAt={resetsAt ?? new Date().toISOString()}
            configured={configured}
            unconfiguredReason={unconfiguredReason}
            placeholder="Ask Mara about the companies you want to win"
            emptyTitle=""
            emptyBody=""
            suggestions={started ? [] : SUGGESTIONS}
            conversationId={activeConversationId}
            onOpened={(id) => {
              if (id !== activeConversationId) router.replace(`/market?c=${id}`);
            }}
            renderAnswer={(message) => {
              const sections = parseBriefing(message.body);
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
      </div>

      <PersonaPanel
        state={state}
        lastRead={lastRead}
        domains={domains}
        memories={memories}
        onManage={() => router.push("/market?memory=1")}
        onTellHer={() => setTellOpen(true)}
      />

      <TellMaraDrawer
        open={tellOpen}
        onClose={() => setTellOpen(false)}
        memories={memories}
        canManageAgency={canManageAgency}
        meId={meId}
      />
    </main>
  );
}
