"use client";

import { History, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useRef, useState } from "react";
import { Briefing, parseBriefing } from "@/components/ai/briefing";
import { ChatPanel } from "@/components/ai/chat-panel";
import type { MaraState } from "@/components/mara/avatar";
import { DebriefCard } from "@/components/mara/debrief";
import { CommitmentsLedger } from "@/components/mara/ledger";
import { MetricsStrip, type Metric } from "@/components/mara/metrics";
import { PersonaPanel, type Domain } from "@/components/mara/persona-panel";
import { SignalsFeed } from "@/components/mara/signals-feed";
import { TellMaraDrawer } from "@/components/mara/tell-mara";
import { TodaysPlay, type PlaySignal } from "@/components/mara/todays-play";
import { Drawer } from "@/components/ui/overlay";
import type {
  BDAgentMemoryRow,
  BDCommitmentRow,
  ChatConversationRow,
  ChatRow,
} from "@/lib/supabase/types";
import { AnswerFeedback } from "@/app/(app)/market/answer-feedback";
import { ConversationList } from "@/app/(app)/market/conversation-list";

import { agent } from "@/config/brand";
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
  todayLabel,
  debriefDue,
  nowMs,
  lastRead,
  canManageAgency,
  meId,
  available,
  allowance,
  resetsAt,
  configured,
  unconfiguredReason,
  pendingQuestion,
  openMemory,
  conversations,
  activeConversationId,
  todayKey,
  yesterdayKey,
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
  /** "Friday 7 August", formatted on the server for the same reason. */
  todayLabel: string;
  /** The promise Mara asks about after 17:00, or null when there is nothing to ask. */
  debriefDue: BDCommitmentRow | null;
  nowMs: number;
  lastRead: string;
  canManageAgency: boolean;
  meId: string;
  available: number;
  allowance: number;
  resetsAt: string | null;
  configured: boolean;
  unconfiguredReason: string;
  /** A question passed in the URL by "Ask Reyhan how", fired once on arrival. */
  pendingQuestion: string | null;
  /** True when "Manage" sent the user here to see what the agent knows. */
  openMemory: boolean;
  conversations: ChatConversationRow[];
  activeConversationId: string | null;
  /** Fixed on the server so Today/Yesterday cannot disagree after hydration. */
  todayKey: string;
  yesterdayKey: string;
}) {
  const router = useRouter();
  const [tellOpen, setTellOpen] = useState(openMemory);
  const [historyOpen, setHistoryOpen] = useState(false);

  // ChatPanel owns the run lifecycle, so it hands `ask` back here and the
  // suggestion chips live in the scroll region above rather than in the pinned
  // composer block. Held in a ref: calling it must not re-render the stage.
  const askRef = useRef<((text: string) => void) | null>(null);
  // Guards the one-shot: a refresh must not re-ask a question that is already
  // in the transcript, and re-running an Exa research call costs real credits.
  const askedRef = useRef(false);
  const onReady = useCallback(
    (ask: (text: string) => void) => {
      askRef.current = ask;
      if (pendingQuestion && !askedRef.current && configured) {
        askedRef.current = true;
        // Drop the param first, so a reload is not a second paid run.
        router.replace("/market");
        ask(pendingQuestion);
      }
    },
    [pendingQuestion, configured, router],
  );

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
        {/*
          Two scroll regions competing for one screen is what buried the
          signals feed below the fold: the stage and the transcript were both
          flex-1, so each got half the height and each scrolled separately.

          On the landing state the stage is the only thing above the composer,
          so it takes the scroll and the transcript takes none. Inside a
          conversation that reverses: the ledger pins to the top at its natural
          height and the transcript gets everything else.
        */}
        <div
          className={
            started
              ? // Pinned. The ledger stays because an open promise is the one
                // thing worth interrupting a conversation for.
                "shrink-0 border-b border-mara-rule px-7 pb-3 pt-4"
              : // One scroll for the whole landing state. The composer is the
                // only thing pinned under it, so a short window scrolls the
                // page rather than squeezing the stage into a box with its own
                // scrollbar and a slab of chrome beneath.
                "min-h-0 flex-1 overflow-y-auto px-7 pb-2 pt-7"
          }
        >
          <div className="mx-auto flex w-full max-w-[720px] flex-col gap-3">
            {/* The rail used to hold history. This screen is two columns, so
                past threads live behind a button rather than a third strip. */}
            <div className="flex items-center justify-end gap-1.5">
              {started ? (
                <button
                  onClick={() => router.push("/market?c=new")}
                  className="settle flex items-center gap-1.5 rounded-control border border-mara-rule bg-mara-sheet px-2.5 py-1 text-[11px] leading-[1.45] text-mara-ink-2 hover:border-mara-violet hover:text-mara-violet"
                >
                  <Plus size={13} strokeWidth={1.75} aria-hidden />
                  New
                </button>
              ) : null}
              {conversations.length > 0 ? (
                <button
                  onClick={() => setHistoryOpen(true)}
                  className="settle flex items-center gap-1.5 rounded-control border border-mara-rule bg-mara-sheet px-2.5 py-1 text-[11px] leading-[1.45] text-mara-ink-2 hover:border-mara-violet hover:text-mara-violet"
                >
                  <History size={13} strokeWidth={1.75} aria-hidden />
                  Past conversations
                </button>
              ) : null}
            </div>

            {!started ? (
              <div className="mara-in flex flex-col gap-1">
                {/* PLS-180. The serif, per the Figma and DESIGN.md 4z. The date
                    sits opposite it, which is the editorial move: a title and
                    its dateline. */}
                <div className="flex items-baseline justify-between gap-4">
                  <h1 className="page-title text-mara-ink">
                    {greetingFor(serverHour)}, {firstName}
                  </h1>
                  <p className="shrink-0 text-[12px] leading-[1.45] text-mara-ink-3">
                    {todayLabel}
                  </p>
                </div>
                <p className="text-[13px] leading-[1.5] text-mara-ink-2">
                  {commitments.length > 0
                    ? `You have ${commitments.length} open ${commitments.length === 1 ? "promise" : "promises"}. Let's start there.`
                    : "Nothing outstanding. Ask me about the companies you want to win."}
                </p>
              </div>
            ) : null}

            {!started && !configured ? (
              <div className="mara-in flex items-start gap-2.5 rounded-shell border border-mara-amber-edge bg-mara-amber-bg px-3 py-2.5">
                <span className="min-w-0">
                  <span className="meta block text-mara-amber-ink">
                    NOT AVAILABLE
                  </span>
                  <span className="mt-1 block text-[12px] leading-[1.5] text-mara-ink">
                    {unconfiguredReason}
                  </span>
                </span>
              </div>
            ) : null}

            {/* Evening only, and above the ledger: at 5pm the useful thing is
                not the list, it is the one question about the promise you
                made this morning. */}
            {!started ? <DebriefCard commitment={debriefDue} /> : null}

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

                {/* Both of these used to sit in the pinned composer block,
                    where they cost the stage ~250px on every screen and
                    pushed the signals feed out of view on a short window.
                    They are content, so they scroll with the content. */}
                {configured ? (
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {SUGGESTIONS.map((suggestion) => (
                      <button
                        key={suggestion}
                        onClick={() => askRef.current?.(suggestion)}
                        className="settle rounded-control border border-mara-rule bg-mara-sheet px-2.5 py-1.5 text-left text-[12px] leading-[1.45] text-mara-ink-2 hover:border-mara-violet hover:text-mara-violet"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                ) : null}
              </>
            ) : null}
          </div>
        </div>

        <div
          className={
            started
              ? "flex min-h-0 flex-1 flex-col overflow-hidden"
              : "flex shrink-0 flex-col border-t border-mara-rule px-7 pb-4 pt-3"
          }
        >
          <ChatPanel
            chromeless={!started}
            onReady={onReady}
            surface="market"
            messages={messages}
            available={available}
            weeklyAllowance={allowance}
            resetsAt={resetsAt ?? new Date().toISOString()}
            configured={configured}
            unconfiguredReason={unconfiguredReason}
            placeholder={`Ask ${agent.name} about the companies you want to win`}
            emptyTitle=""
            emptyBody=""
            suggestions={SUGGESTIONS}
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

      <Drawer
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        label="Past conversations"
      >
        <ConversationList
          conversations={conversations}
          activeId={activeConversationId}
          meId={meId}
          todayKey={todayKey}
          yesterdayKey={yesterdayKey}
          onSelect={(id) => {
            setHistoryOpen(false);
            router.push(`/market?c=${id}`);
          }}
          onNew={() => {
            setHistoryOpen(false);
            router.push("/market?c=new");
          }}
        />
      </Drawer>

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
