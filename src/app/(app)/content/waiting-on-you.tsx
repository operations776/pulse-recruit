"use client";

import { skillColour } from "@/config/content-skills";
import type { PostRow, Shape } from "@/lib/supabase/types";
import { shapeForPost } from "@/lib/shapes";
import { dayLabel, timeOfDay } from "@/lib/time";

/**
 * Waiting on you, from the Figma planner.
 *
 * The week strip answers "what is going out". This answers the other half:
 * what is stuck, and what is the one action that unsticks it. Every row
 * carries its verb rather than making somebody open the post to find out.
 *
 * Only rows a person can actually act on appear here. A scheduled post going
 * out on Thursday is not waiting on anyone, and a published one is finished.
 */

type Waiting = {
  post: PostRow;
  /** Why it is here, in the fewest words that are still true. */
  reason: string;
  /** The state word, per DESIGN.md rule 9: colour never carries this alone. */
  word: string;
  tone: string;
  dot: string;
  /** The one thing to do. Null when the fix is not a button on this screen. */
  primary: { label: string; kind: "review" | "schedule" | "retry" } | null;
};

/**
 * What is actually blocked, in the order it is worth clearing.
 *
 * Ordered by how recoverable each state is rather than alphabetically or by
 * date: a failed post is the only one losing reach every hour it sits there.
 */
export function waitingRows(
  posts: PostRow[],
  shapes: Shape[],
  tz: string,
): Waiting[] {
  const rows: Waiting[] = [];

  for (const post of posts) {
    if (post.status === "failed") {
      rows.push({
        post,
        reason: post.publish_error || "LinkedIn refused this one.",
        word: "Did not send",
        tone: "text-red",
        dot: "bg-red",
        primary: { label: "Try again", kind: "retry" },
      });
      continue;
    }

    if (post.status === "needs_attention") {
      rows.push({
        post,
        // The real reason, written by the publisher. A generic line here would
        // be the exact failure PLS-153 split this status out to avoid.
        reason: post.attention_reason || "Pulse could not reach LinkedIn.",
        word: "Needs attention",
        tone: "text-amber-text",
        dot: "bg-amber",
        primary: null,
      });
      continue;
    }

    if (post.status === "needs_review") {
      rows.push({
        post,
        reason: post.scheduled_for
          ? `Goes out ${dayLabel(post.scheduled_for, tz)} ${timeOfDay(post.scheduled_for, tz)}`
          : "No date yet.",
        word: "Needs review",
        tone: "text-amber-text",
        dot: "bg-amber",
        primary: { label: "Review", kind: "review" },
      });
      continue;
    }

    // A finished draft with nowhere to go. Not broken, just unscheduled, and
    // the only reason it is here is that nothing will ever move it on its own.
    if (post.status === "drafted" && !post.scheduled_for) {
      rows.push({
        post,
        reason: "Written, with no date.",
        word: "Needs a date",
        tone: "text-ink-2",
        dot: "bg-ink-3",
        primary: { label: "Schedule", kind: "schedule" },
      });
    }
  }

  void shapes;
  return rows;
}

export function WaitingOnYou({
  rows,
  shapes,
  onOpen,
  onAct,
}: {
  rows: Waiting[];
  shapes: Shape[];
  onOpen: (post: PostRow) => void;
  onAct: (post: PostRow, kind: "review" | "schedule" | "retry") => void;
}) {
  if (rows.length === 0) return null;

  return (
    <section className="mt-4 overflow-hidden rounded-shell border border-rule bg-sheet">
      <div className="flex items-center justify-between gap-3 border-b border-rule px-4 py-2.5">
        <h2 className="display text-[13px]">Waiting on you</h2>
        <span className="meta text-ink-3">{rows.length}</span>
      </div>

      <ul className="divide-y divide-rule">
        {rows.map(({ post, reason, word, tone, dot, primary }) => {
          const shape = shapeForPost(post, shapes);
          const accent = skillColour(shape.key);

          return (
            <li
              key={post.id}
              className={`flex items-center gap-3 border-l-[3px] px-3.5 py-2.5 ${accent.edge}`}
            >
              <button
                type="button"
                onClick={() => onOpen(post)}
                className="min-w-0 flex-1 text-left"
              >
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span
                    aria-hidden
                    className={`size-1.5 shrink-0 rounded-chip ${dot}`}
                  />
                  <span className={`legend ${tone}`}>{word}</span>
                  <span className="legend text-ink-3">{shape.name}</span>
                </span>
                <span className="mt-1 block truncate text-[13px] font-medium leading-[1.5] text-ink">
                  {post.hook || "Untitled"}
                </span>
                <span className="mt-0.5 block truncate text-[12px] leading-[1.4] text-ink-2">
                  {reason}
                </span>
              </button>

              {/* One verb, visible. Nothing behind hover and nothing behind an
                  overflow menu: DESIGN.md section 2 names hover-to-reveal as the
                  pattern that fails this audience hardest. */}
              {primary ? (
                <button
                  type="button"
                  onClick={() => onAct(post, primary.kind)}
                  className="cap flex h-7 shrink-0 items-center rounded-control bg-violet px-3 text-[12px] font-medium text-on-violet [--edge:var(--color-violet-edge)] hover:bg-violet-hover"
                >
                  {primary.label}
                </button>
              ) : (
                // needs_attention has no button because the fix is not on this
                // screen: reconnect the account in Settings, then reschedule.
                // A button that cannot work is worse than none.
                <span className="legend shrink-0 text-ink-3">
                  Settings, Channels
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
