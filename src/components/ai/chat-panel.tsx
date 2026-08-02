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
  headerRight,
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
  headerRight?: ReactNode;
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
          body: JSON.stringify({ surface, question: text }),
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
    [router, run, surface],
  );

  const submit = () => {
    void ask(draft);
  };

  const busy = run !== null;
  const canAsk = configured && !busy && draft.trim().length > 0;

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-shell border border-rule bg-sheet">
      {headerRight ? (
        <div className="flex items-start justify-between gap-4 border-b border-rule px-4 py-3">
          <p className="legend text-ink-3">Conversation</p>
          {headerRight}
        </div>
      ) : null}

      {!configured ? (
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
      {suggestions.length > 0 && messages.length === 0 && !busy ? (
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

      <div
        ref={transcriptRef}
        className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-4"
      >
        {messages.length === 0 && !busy && !failure ? (
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
              <div className="max-w-[80%] rounded-card border border-rule bg-sheet px-3 py-2.5">
                <p className="whitespace-pre-line text-[13px] leading-[1.5]">
                  {m.body}
                </p>
                <SourceList sources={sources} />
                {m.credits_spent > 0 ? (
                  <AnswerCost credits={m.credits_spent} meta={meta} />
                ) : null}
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
          <p className="meta text-ink-3">
            {weeklyAllowance > 0
              ? `${available} of ${weeklyAllowance} credits left, resets ${formatDate(resetsAt)}. Cmd + Enter to ask`
              : "Cmd + Enter to ask"}
          </p>
          <Button variant="primary" type="submit" disabled={!canAsk}>
            {busy ? "Working" : "Ask"}
          </Button>
        </div>
      </form>
    </section>
  );
}
