"use client";

import { useRouter } from "next/navigation";
import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { ask } from "@/lib/actions";
import type { ChatRow, ChatSource, ChatSurface } from "@/lib/supabase/types";
import { formatDate } from "@/lib/time";

// One chat surface, two pillars. MARKET asks the open web and pays credits for
// it, OPS asks your own pipeline and pays nothing. The only difference the
// component knows about is the surface key, so the two screens can never drift
// apart in behaviour.
//
// Messages arrive from the server component above. The panel owns nothing but
// the draft, so a refresh after a successful ask is the only way new answers
// appear, and there is no second copy of the transcript to fall out of step.
//
// DESIGN.md section 7: the panel is one shell. Header, suggestions, transcript
// and composer meet on 1px rules with no gap.
export function ChatPanel({
  surface,
  messages,
  creditsLeft,
  weeklyAllowance,
  resetsAt,
  placeholder,
  suggestions = [],
  emptyTitle,
  emptyBody,
  headerRight,
}: {
  surface: ChatSurface;
  messages: ChatRow[];
  creditsLeft: number;
  weeklyAllowance: number;
  resetsAt: string;
  placeholder: string;
  suggestions?: string[];
  emptyTitle: string;
  emptyBody: string;
  headerRight?: ReactNode;
}) {
  const router = useRouter();
  const { notify } = useToast();
  const [draft, setDraft] = useState("");
  const [pending, startTransition] = useTransition();
  const transcriptRef = useRef<HTMLDivElement>(null);

  // A new answer lands at the bottom, so the bottom is where the eye needs to
  // be. Scroll position only, no animation.
  useEffect(() => {
    const el = transcriptRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  const submit = () => {
    const text = draft.trim();
    if (!text || pending) return;

    startTransition(async () => {
      const result = await ask(surface, text);

      // Never swallow the reason. The action already translated it into
      // something a recruiter can act on.
      if (!result.ok) {
        notify(result.error, "danger");
        return;
      }

      // answered false means the weekly allowance is spent. The question did
      // not run, so the box keeps the text and the toast says so plainly.
      // Clearing the box on a refusal reads as a sent message.
      if (!result.data.answered) {
        notify(
          `Your weekly research allowance is spent, so this question has not been asked. It resets on ${formatDate(resetsAt)}.`,
          "danger",
        );
        return;
      }

      setDraft("");
      router.refresh();
    });
  };

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-shell border border-rule bg-sheet">
      {headerRight ? (
        <div className="flex items-start justify-between gap-4 border-b border-rule px-4 py-3">
          <p className="legend text-ink-3">Conversation</p>
          {headerRight}
        </div>
      ) : null}

      {suggestions.length > 0 ? (
        <div className="border-b border-rule px-4 py-3">
          <p className="legend text-ink-3">Start with one of these</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <Button key={s} onClick={() => setDraft(s)}>
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
        {messages.length === 0 ? (
          <EmptyState title={emptyTitle} body={emptyBody} />
        ) : (
          messages.map((m) => {
            if (m.role === "user") {
              return (
                <div key={m.id} className="flex justify-end">
                  <p className="max-w-[70%] rounded-card bg-well px-3 py-2 text-[13px] leading-[1.5]">
                    {m.body}
                  </p>
                </div>
              );
            }

            // sources is jsonb, so an old or partial row can hand back
            // something that is not an array. Guard rather than crash a
            // transcript over one bad record.
            const sources: ChatSource[] = Array.isArray(m.sources)
              ? m.sources
              : [];

            return (
              <div key={m.id} className="flex justify-start">
                <div className="max-w-[80%] rounded-card border border-rule bg-sheet px-3 py-2.5">
                  <p className="whitespace-pre-line text-[13px] leading-[1.5]">
                    {m.body}
                  </p>

                  {sources.length > 0 ? (
                    <div className="mt-3 border-t border-rule pt-2.5">
                      <p className="legend text-ink-3">Built from</p>
                      <div className="mt-1.5">
                        {sources.map((s, i) => (
                          <div
                            key={s.label}
                            className={`flex items-baseline justify-between gap-4 py-1.5 ${
                              i > 0 ? "border-t border-rule" : ""
                            }`}
                          >
                            <span className="shrink-0 text-[12px] font-medium">
                              {s.label}
                            </span>
                            <span className="text-right text-[12px] text-ink-2">
                              {s.detail}
                            </span>
                          </div>
                        ))}
                      </div>
                      {m.credits_spent > 0 ? (
                        <p className="meta mt-1.5 text-ink-3">
                          {m.credits_spent} credits
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })
        )}
      </div>

      <form
        className="border-t border-rule px-4 py-3"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <Textarea
          rows={2}
          value={draft}
          placeholder={placeholder}
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
              ? `${creditsLeft} of ${weeklyAllowance} credits left. Cmd + Enter to ask`
              : "Cmd + Enter to ask"}
          </p>
          <Button variant="primary" type="submit" disabled={pending}>
            {pending ? "Asking" : "Ask"}
          </Button>
        </div>
      </form>
    </section>
  );
}
