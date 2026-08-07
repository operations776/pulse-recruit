"use client";

import { History, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useRef, useState } from "react";
import { Briefing, parseBriefing } from "@/components/ai/briefing";
import { ASK_FORM_ID, ChatPanel } from "@/components/ai/chat-panel";
import { MaraAvatar, type MaraState } from "@/components/mara/avatar";
import type { RunPhase } from "@/lib/ai-events";
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

// "Two things moved on your patch overnight." Words up to nine because that is
// how the sentence would be said; digits past that because "seventeen things"
// is a number pretending to be prose.
const COUNT_WORDS = [
  "",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
] as const;

const countWord = (n: number) => COUNT_WORDS[n] ?? String(n);

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
  clientCount,
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
  clientCount: number;
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

  // The avatar states board, as behaviour. Speaking is WHILE STREAMING, which
  // an earlier build got wrong: it derived speaking from the last settled
  // message, so the face sat open-mouthed forever after any answer. Live run
  // state, focus and failure are the only causes; anything else would be a
  // mood with nothing behind it.
  const [running, setRunning] = useState<{
    busy: boolean;
    phase: RunPhase | null;
  }>({ busy: false, phase: null });
  const [failed, setFailed] = useState(false);
  const [focused, setFocused] = useState(false);

  const state: MaraState = failed
    ? "stumped"
    : running.busy
      ? running.phase === "writing"
        ? "speaking"
        : "thinking"
      : focused
        ? "listening"
        : "idle";

  // The briefing owns the screen once there is one. Below this threshold the
  // stage is the page; above it the stage is a header.
  const started = messages.length > 0;

  // The disagreement treatment's two replies belong on the newest answer
  // only: "No, do it mine" under a week-old push-back would fire a follow-up
  // into a context the model has long moved past.
  const lastAnswerId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.role === "assistant" && m.status === "complete") return m.id;
    }
    return null;
  }, [messages]);

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
                {/* The dateline's sentence counts what MOVED, per the frame:
                    "Two things moved on your patch overnight. Start with the
                    first one." Promises are the fallback subject, not the
                    lead, because the feed below is what the sentence points
                    at. */}
                <p className="text-[13px] leading-[1.5] text-mara-ink-2">
                  {(() => {
                    // "Overnight" only when it is true. The feed's window is
                    // seven days, so a quiet night falls back to the week
                    // rather than claiming freshness it does not have.
                    const overnight = signals.filter(
                      (signal) =>
                        nowMs - new Date(signal.detected_at).getTime() <
                        86_400_000,
                    ).length;
                    if (overnight > 0)
                      return `${countWord(overnight)} ${overnight === 1 ? "thing" : "things"} moved on your patch overnight. Start with the first one.`;
                    if (signals.length > 0)
                      return `${countWord(signals.length)} ${signals.length === 1 ? "thing" : "things"} moved on your patch this week. Start with the first one.`;
                    if (commitments.length > 0)
                      return `You have ${commitments.length} open ${commitments.length === 1 ? "promise" : "promises"}. Let's start there.`;
                    return "Nothing outstanding. Ask me about the companies you want to win.";
                  })()}
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
                  {/* The play is the most ACTIONABLE signal, not merely the
                      freshest: an open-roles signal outranks a funding round
                      because one is a brief to win this week and the other is
                      a company to watch this quarter. */}
                  <TodaysPlay
                    signal={
                      signals.find(
                        (signal) =>
                          signal.kind === "open_role" ||
                          signal.kind === "promotion",
                      ) ??
                      signals[0] ??
                      null
                    }
                  />
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
            placeholder="Ask about a company, a client, or where your offer is losing"
            emptyTitle=""
            emptyBody=""
            suggestions={SUGGESTIONS}
            conversationId={activeConversationId}
            onOpened={(id) => {
              if (id !== activeConversationId) router.replace(`/market?c=${id}`);
            }}
            onRunStateChange={setRunning}
            onComposerFocus={setFocused}
            onFailureChange={setFailed}
            // The face beside every reply, per the frame: an answer spoken by
            // someone, not emitted into a box.
            answerAvatar={<MaraAvatar state="idle" size={30} />}
            // The stumped face and its line, in character. The reason is the
            // server's, verbatim: character never replaces the actual cause.
            renderFailure={(reason, canRetry) => (
              <div className="flex w-full items-start gap-2.5 rounded-card bg-mara-well px-3.5 py-3">
                <MaraAvatar state="stumped" size={30} className="mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-[13px] leading-[1.5] text-mara-ink">
                    Lost my thread there. {reason}
                  </p>
                  {canRetry ? (
                    // Submits the composer form by association: the failed
                    // question is already back in the box.
                    <button
                      type="submit"
                      form={ASK_FORM_ID}
                      className="settle mt-2 rounded-control border border-mara-rule bg-mara-sheet px-3 py-1.5 text-[12px] leading-[1.45] text-mara-ink-2 hover:border-mara-violet hover:text-mara-violet"
                    >
                      Try again
                    </button>
                  ) : null}
                </div>
              </div>
            )}
            renderAnswer={(message) => {
              const sections = parseBriefing(message.body);
              const pushbackActions =
                message.id === lastAnswerId &&
                sections?.some((section) => section.key === "pushback") ? (
                  <div className="mt-2.5 flex items-center gap-2">
                    <button
                      onClick={() =>
                        askRef.current?.(
                          "Fine, draft it your way and show me why it wins.",
                        )
                      }
                      className="settle rounded-control border border-mara-rule bg-mara-sheet px-3 py-1.5 text-[12px] leading-[1.45] text-mara-ink hover:border-mara-violet hover:text-mara-violet"
                    >
                      Draft it {agent.possessive} way
                    </button>
                    <button
                      onClick={() =>
                        askRef.current?.(
                          "No, do it mine. Draft it the way I asked.",
                        )
                      }
                      className="settle rounded-control border border-mara-rule bg-mara-sheet px-3 py-1.5 text-[12px] leading-[1.45] text-mara-ink-2 hover:border-mara-violet hover:text-mara-violet"
                    >
                      No, do it mine
                    </button>
                  </div>
                ) : undefined;
              if (!sections) {
                return (
                  <p className="whitespace-pre-line text-[13px] leading-[1.5]">
                    {message.body}
                  </p>
                );
              }
              return (
                <Briefing sections={sections} pushbackActions={pushbackActions} />
              );
            }}
            answerFooter={(message) =>
              message.status === "complete" ? (
                <>
                  {/* The grounding worn on the answer: the context the
                      strategist holds and answers against. Titles only, the
                      full facts live in the drawer. */}
                  {memories.length > 0 ? (
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {memories.slice(0, 4).map((memory) => (
                        <span
                          key={memory.id}
                          title={memory.body}
                          className="rounded-[20px] border border-mara-rule bg-mara-sheet px-2.5 py-1 text-[11px] leading-[1.45] text-mara-ink-2"
                        >
                          {memory.title}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  <AnswerFeedback
                    answerId={message.id}
                    existing={feedbackByAnswer[message.id] ?? null}
                  />
                </>
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
        clientCount={clientCount}
      />
    </main>
  );
}
