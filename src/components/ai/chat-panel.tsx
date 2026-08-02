"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { useStore } from "@/lib/store";
import { formatDate } from "@/lib/time";
import type { ChatSurface } from "@/lib/types";

// One chat surface, two pillars. MARKET asks the open web and pays credits for
// it, OPS asks your own pipeline and pays nothing. The only difference the
// component knows about is the surface key, so the two screens can never drift
// apart in behaviour.
//
// DESIGN.md section 7: the panel is one shell. Header, suggestions, transcript
// and composer meet on 1px rules with no gap.
export function ChatPanel({
  surface,
  placeholder,
  emptyTitle,
  emptyBody,
  headerRight,
  suggestions = [],
}: {
  surface: ChatSurface;
  placeholder: string;
  emptyTitle: string;
  emptyBody: string;
  headerRight?: ReactNode;
  suggestions?: string[];
}) {
  const { state, ask, chatFor } = useStore();
  const { notify } = useToast();
  const [draft, setDraft] = useState("");
  const transcriptRef = useRef<HTMLDivElement>(null);

  const messages = chatFor(surface);

  // A new answer lands at the bottom, so the bottom is where the eye needs to
  // be. Scroll position only, no animation.
  useEffect(() => {
    const el = transcriptRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  const submit = () => {
    const text = draft.trim();
    if (!text) return;

    // ask returns false when the weekly allowance is spent. The question did
    // not run, so the input keeps the text and the toast says so plainly.
    // Never clear the box on a refusal: that reads as a sent message.
    const ran = ask(surface, text);
    if (!ran) {
      notify(
        `Your weekly research allowance is spent, so this question has not been asked. It resets on ${formatDate(state.credits.resetsAt)}.`,
        "danger",
      );
      return;
    }
    setDraft("");
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
          messages.map((m) =>
            m.role === "user" ? (
              <div key={m.id} className="flex justify-end">
                <p className="max-w-[70%] rounded-card bg-well px-3 py-2 text-[13px] leading-[1.5]">
                  {m.body}
                </p>
              </div>
            ) : (
              <div key={m.id} className="flex justify-start">
                <div className="max-w-[80%] rounded-card border border-rule bg-sheet px-3 py-2.5">
                  <p className="whitespace-pre-line text-[13px] leading-[1.5]">
                    {m.body}
                  </p>

                  {m.sources && m.sources.length > 0 ? (
                    <div className="mt-3 border-t border-rule pt-2.5">
                      <p className="legend text-ink-3">Built from</p>
                      <div className="mt-1.5">
                        {m.sources.map((s, i) => (
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
                      {m.creditsSpent ? (
                        <p className="meta mt-1.5 text-ink-3">
                          {m.creditsSpent} credits
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
            ),
          )
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
          <p className="meta text-ink-3">Cmd + Enter to ask</p>
          <Button variant="primary" type="submit">
            Ask
          </Button>
        </div>
      </form>
    </section>
  );
}
