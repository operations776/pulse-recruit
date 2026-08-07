"use client";

import { AlertTriangle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { AnswerCost, AnswerFailure, SourceList } from "@/components/ai/answer";
import { RunLog, type LogStep } from "@/components/ai/run-log";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/misc";
import { decodeEvents, type RunPhase } from "@/lib/ai-events";
import type { ChatRow, ChatSource, ChatSurface } from "@/lib/supabase/types";
import { formatDate } from "@/lib/time";

import { DictateButton } from "@/components/ai/dictate";
// One panel, two surfaces. The surface decides the tool set on the server and
// the wording here; the behaviour is identical on purpose, because two chat
// screens that drift apart is how a product starts feeling unfinished.
//
// A run streams (AI.md section 7). The panel holds the in-flight run in local
// state and the finished transcript comes from the server, so there is never a
// second copy of a settled answer to fall out of step.

type LiveRun = {
  question: string;
  phase: RunPhase;
  steps: LogStep[];
  sources: ChatSource[];
  draft: string;
};

const EMPTY_RUN = (question: string): LiveRun => ({
  question,
  phase: "reserving",
  steps: [],
  sources: [],
  draft: "",
});

export function ChatPanel({
  surface,
  messages,
  available,
  weeklyAllowance,
  resetsAt,
  configured,
  unconfiguredReason,
  placeholder,
  suggestions = [],
  emptyTitle,
  emptyBody,
  chromeless = false,
  onReady,
  headerRight,
  renderAnswer,
  answerFooter,
  conversationId,
  onOpened,
  onRunStateChange,
}: {
  surface: ChatSurface;
  messages: ChatRow[];
  available: number;
  weeklyAllowance: number;
  resetsAt: string;
  // Platform keys live in Vercel, so whether the engine can run at all is a
  // deployment fact, not something the recruiter can fix. Say so rather than
  // taking a question and failing it.
  configured: boolean;
  unconfiguredReason: string;
  placeholder: string;
  suggestions?: string[];
  emptyTitle: string;
  emptyBody: string;
  /**
   * Drop the card shell and let the caller own the scroll.
   *
   * With no transcript there is nothing for a bordered box to contain, and a
   * box that cannot shrink turns the page into two competing scroll regions:
   * a short stage scrolling inside a frame, with a tall slab of chrome pinned
   * under it. Chromeless, the panel contributes only the composer, and the
   * stage above it scrolls as one page.
   */
  chromeless?: boolean;
  /**
   * Hand the caller a way to fire a question.
   *
   * `ask` owns the whole run lifecycle, so it has to stay in here. Chromeless
   * the panel is pinned to the bottom of the screen and anything it stacks
   * there costs the stage that height, so the caller puts the suggestion chips
   * in its own scroll region and calls back in through this.
   */
  onReady?: (ask: (text: string) => void) => void;
  headerRight?: ReactNode;
  /**
   * Render a settled assistant turn. Omitted, the answer is a plain paragraph.
   * MARKET passes a briefing renderer; OPS deliberately does not.
   */
  renderAnswer?: (message: ChatRow) => ReactNode;
  /** Controls under a settled answer, such as BD coaching feedback. */
  answerFooter?: (message: ChatRow) => ReactNode;
  /** The thread to continue. Null or undefined starts a new one. */
  conversationId?: string | null;
  /** The thread the run actually landed in, so the caller can switch to it. */
  onOpened?: (conversationId: string) => void;
  /**
   * The live run state, lifted so a caller can show it outside this panel.
   * PLS-110 uses it for the strategist's Ready/Thinking indicator, which sits
   * in the rail rather than in the transcript.
   */
  onRunStateChange?: (state: { busy: boolean; phase: RunPhase | null }) => void;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState("");
  const [run, setRun] = useState<LiveRun | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);

  // Follow the run as it writes. Scroll position only, no smooth behaviour:
  // DESIGN.md section 10 allows transform and opacity, and nothing else.
  useEffect(() => {
    const el = transcriptRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, run?.draft, run?.steps.length, failure]);

  const busy = run !== null;
  const phase = run?.phase ?? null;

  // Held in a ref so an inline callback from the parent does not re-fire this
  // on every parent render. The notification is owed when the run state
  // changes, not when the caller re-renders. Declared before the effect that
  // reads it, so it is populated by the time that one runs.
  const notifyRunState = useRef(onRunStateChange);
  useEffect(() => {
    notifyRunState.current = onRunStateChange;
  }, [onRunStateChange]);

  useEffect(() => {
    notifyRunState.current?.({ busy, phase });
  }, [busy, phase]);

  const ask = useCallback(
    async (question: string) => {
      const text = question.trim();
      if (!text || run) return;

      setFailure(null);
      setRun(EMPTY_RUN(text));
      setDraft("");

      let response: Response;
      try {
        response = await fetch("/api/ask", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ surface, question: text, conversationId }),
        });
      } catch {
        setRun(null);
        setDraft(text);
        setFailure("Pulse could not be reached. Nothing was charged.");
        return;
      }

      // A refusal arrives as JSON, not as a stream: no allowance, not signed
      // in, question too long. The text goes back in the box, because clearing
      // it would read as sent.
      if (!response.ok || !response.body) {
        const body = await response.json().catch(() => ({ error: "" }));
        setRun(null);
        setDraft(text);
        setFailure(
          body.error ||
            "That question could not be asked. Nothing was charged.",
        );
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let settled = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const { events, rest } = decodeEvents(buffer);
        buffer = rest;

        for (const event of events) {
          switch (event.type) {
            case "opened":
              // The run tells us which thread it landed in. A first question
              // creates one server-side, so the client cannot know the id
              // until now, and the history panel needs it to highlight the
              // right row.
              if (event.conversationId) onOpened?.(event.conversationId);
              break;
            case "phase":
              setRun((r) => (r ? { ...r, phase: event.phase } : r));
              break;
            case "step":
              setRun((r) =>
                r
                  ? { ...r, steps: [...r.steps, { label: event.label, detail: event.detail }] }
                  : r,
              );
              break;
            case "source":
              setRun((r) => (r ? { ...r, sources: [...r.sources, event.source] } : r));
              break;
            case "delta":
              setRun((r) => (r ? { ...r, draft: r.draft + event.text } : r));
              break;
            case "reset":
              // What streamed was the model thinking before reaching for a
              // tool. Drop it rather than leaving half a sentence on screen.
              setRun((r) => (r ? { ...r, draft: "" } : r));
              break;
            case "error":
              settled = true;
              setFailure(event.message);
              if (event.retryable) setDraft(text);
              break;
            case "done":
              settled = true;
              break;
            default:
              break;
          }
        }
      }

      // The server settles the run either way, so a stream that ends without a
      // done event is still accounted for. Say so rather than looking finished.
      if (!settled) {
        setFailure(
          "The connection dropped before the answer finished. Any credits it reserved are given back.",
        );
      }

      // Pull the settled transcript, then drop the live copy. Clearing first
      // would blank the answer for a frame.
      router.refresh();
      setRun(null);
      composerRef.current?.focus();
    },
    [router, run, surface, conversationId, onOpened],
  );

  // Publish `ask` so a chromeless caller can fire a suggestion it renders in
  // its own scroll region. In an effect, not during render, and keyed on the
  // identity of `ask` so it re-publishes when the callback changes.
  useEffect(() => {
    onReady?.((text) => void ask(text));
  }, [onReady, ask]);

  const submit = () => {
    void ask(draft);
  };

  const canAsk = configured && !busy && draft.trim().length > 0;

  return (
    <section
      className={
        chromeless
          ? "flex shrink-0 flex-col"
          : "flex min-h-0 flex-1 flex-col overflow-hidden rounded-shell border border-rule bg-sheet"
      }
    >
      {headerRight ? (
        <div className="flex items-start justify-between gap-4 border-b border-rule px-4 py-3">
          <p className="legend text-ink-3">Conversation</p>
          {headerRight}
        </div>
      ) : null}

      {!configured && !chromeless ? (
        <div className="flex items-start gap-2.5 border-b border-rule bg-amber-bg px-4 py-3">
          <AlertTriangle size={16} strokeWidth={1.5} className="mt-0.5 shrink-0 text-amber" />
          <div>
            <p className="legend text-amber-text">Not available</p>
            <p className="mt-1 text-[12px] leading-[1.5] text-ink">
              {unconfiguredReason}
            </p>
          </div>
        </div>
      ) : null}

      {/* Suggestions are scaffolding for an empty screen, not furniture. Once
          there is a transcript they are in the way. */}
      {suggestions.length > 0 && messages.length === 0 && !busy && !chromeless ? (
        <div className="border-b border-rule px-4 py-3">
          <p className="legend text-ink-3">Start with one of these</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <Button key={s} disabled={!configured} onClick={() => void ask(s)}>
                {s}
              </Button>
            ))}
          </div>
        </div>
      ) : null}

      {/*
        An empty transcript still claimed flex-1, so a screen with nothing to
        show reserved a blank region the size of the conversation. Where the
        caller supplies no empty-state copy there is genuinely nothing to
        render, so the region collapses and whatever sits above the panel keeps
        the space.
      */}
      <div
        ref={transcriptRef}
        className={
          // Chromeless there is no card to fill and the caller owns the
          // scroll, so this region is always exactly as tall as its contents.
          // Without this a single failure banner claimed flex-1 and became a
          // full-height slab under the stage.
          chromeless
            ? "flex flex-col gap-3"
            : messages.length === 0 && !busy && !failure && !emptyTitle
              ? "flex flex-col"
              : "flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-4"
        }
      >
        {messages.length === 0 && !busy && !failure && emptyTitle ? (
          <EmptyState title={emptyTitle} body={emptyBody} />
        ) : null}

        {messages.map((m) => {
          if (m.role === "user") {
            return (
              <div key={m.id} className="flex justify-end">
                <p className="max-w-[70%] rounded-card bg-well px-3 py-2 text-[13px] leading-[1.5]">
                  {m.body}
                </p>
              </div>
            );
          }

          if (m.status === "failed") {
            return (
              <div key={m.id} className="flex justify-start">
                <AnswerFailure
                  reason={m.error ?? "This run did not finish. Nothing was charged."}
                />
              </div>
            );
          }

          // sources is jsonb, so an old or partial row can hand back something
          // that is not an array. Guard rather than crash a transcript over one
          // bad record.
          const sources: ChatSource[] = Array.isArray(m.sources) ? m.sources : [];
          const meta = (m.meta ?? {}) as Record<string, unknown>;

          return (
            <div key={m.id} className="flex justify-start">
              {/* Wider than the 80% a chat bubble wants: a BD briefing has
                  four labelled sections and reads badly in a narrow column. */}
              <div
                className={`rounded-card border border-rule bg-sheet px-3 py-2.5 ${
                  renderAnswer ? "w-full" : "max-w-[80%]"
                }`}
              >
                {/* The surface decides how an answer looks. MARKET renders a
                    briefing; OPS keeps the plain paragraph it has always had. */}
                {renderAnswer ? (
                  renderAnswer(m)
                ) : (
                  <p className="whitespace-pre-line text-[13px] leading-[1.5]">
                    {m.body}
                  </p>
                )}
                <SourceList sources={sources} />
                {m.credits_spent > 0 ? (
                  <AnswerCost credits={m.credits_spent} meta={meta} />
                ) : null}
                {answerFooter?.(m)}
              </div>
            </div>
          );
        })}

        {run ? (
          <>
            <div className="flex justify-end">
              <p className="max-w-[70%] rounded-card bg-well px-3 py-2 text-[13px] leading-[1.5]">
                {run.question}
              </p>
            </div>
            <div className="flex justify-start">
              <div className="flex w-[80%] flex-col gap-2.5">
                <RunLog surface={surface} phase={run.phase} steps={run.steps} />
                {run.draft ? (
                  <div className="rounded-card border border-rule bg-sheet px-3 py-2.5">
                    <p className="whitespace-pre-line text-[13px] leading-[1.5]">
                      {run.draft}
                    </p>
                    <SourceList sources={run.sources} legend="Reading" />
                  </div>
                ) : null}
              </div>
            </div>
          </>
        ) : null}

        {failure && !busy ? (
          <div className="flex justify-start">
            <AnswerFailure reason={failure} />
          </div>
        ) : null}
      </div>

      <form
        className="border-t border-rule px-4 py-3"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <Textarea
          ref={composerRef}
          rows={2}
          value={draft}
          disabled={!configured || busy}
          placeholder={configured ? placeholder : "Unavailable until Pulse is configured"}
          aria-label="Your question"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              submit();
            }
          }}
        />
        <div className="mt-2 flex items-center justify-between gap-3">
          {/* The allowance is stated once per screen. When the header carries a
              meter, repeating the same figure here is two statements of one
              fact inside a single shell. */}
          <p className="meta text-ink-3">
            {headerRight || weeklyAllowance === 0
              ? "Cmd + Enter to ask"
              : `${available} of ${weeklyAllowance} credits left, resets ${formatDate(resetsAt)}. Cmd + Enter to ask`}
          </p>
          <span className="flex items-center gap-2">
            {/* PLS-135. Dictation writes into the same draft the keyboard
                does, so everything downstream, the Enter key, the disabled
                state, the ask itself, is unchanged and unaware. */}
            <DictateButton
              disabled={!configured || busy}
              onTranscript={(text) => setDraft(text)}
            />
            <Button variant="primary" type="submit" disabled={!canAsk}>
              {busy ? "Working" : "Ask"}
            </Button>
          </span>
        </div>
      </form>
    </section>
  );
}
