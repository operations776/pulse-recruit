"use client";

import { AlertTriangle, Eye, Loader, XCircle } from "lucide-react";
import { SKILL_BY_KEY, skillColour } from "@/config/content-skills";
import type { PostRow, PostStatus } from "@/lib/supabase/types";
import { dayLabel, timeOfDay } from "@/lib/time";

// The board reads left to right in the order a post actually travels. It shows
// the same rows the calendar does, arranged by state rather than by date, which
// is the view you want when triaging a pile of ideas rather than planning a
// week. All of the writing happens in the drawer the planner owns, so this file
// is presentation only.
//
// Five columns, eight statuses. The Figma's pipeline, left to right in the
// order a post actually travels.
//
// Three statuses share Needs review, because all three mean the same thing to
// the person looking at the board: a human has to touch this before it can go
// anywhere. They keep their own dot and word on the card, per DESIGN.md rule 9,
// so the column being a union does not hide which one a card is in.
//
// `publishing` sits under Scheduled rather than Live. A post on its way out has
// not gone out, and a board that says Live before LinkedIn has confirmed is a
// board that lies for up to a minute.
const COLUMNS: { status: PostStatus; label: string; holds: PostStatus[] }[] = [
  { status: "idea", label: "Ideas", holds: ["idea"] },
  { status: "drafted", label: "Drafting", holds: ["drafted"] },
  {
    status: "needs_review",
    label: "Needs review",
    holds: ["needs_review", "needs_attention", "failed"],
  },
  { status: "scheduled", label: "Scheduled", holds: ["scheduled", "publishing"] },
  { status: "published", label: "Live", holds: ["published"] },
];

/** Where in the pipeline a column sits. Not a status: the card carries that. */
const COLUMN_DOT: Record<string, string> = {
  idea: "bg-ink-3",
  drafted: "bg-violet",
  needs_review: "bg-amber",
  scheduled: "bg-violet",
  published: "bg-teal",
};

/** What a card says about itself, for the statuses a column groups together. */
const CARD_STATE: Partial<
  Record<PostStatus, { word: string; tone: string; Icon: typeof XCircle }>
> = {
  failed: { word: "Did not send", tone: "text-red", Icon: XCircle },
  needs_attention: { word: "Needs attention", tone: "text-amber-text", Icon: AlertTriangle },
  needs_review: { word: "Review", tone: "text-amber-text", Icon: Eye },
  publishing: { word: "Sending", tone: "text-amber-text", Icon: Loader },
};

const pad2 = (n: number) => String(n).padStart(2, "0");

export function StatusBoard({
  posts,
  timezone,
  onOpen,
  onAdd,
}: {
  posts: PostRow[];
  timezone: string;
  onOpen: (post: PostRow) => void;
  onAdd: () => void;
}) {
  return (
    // Section inside the planner shell, not a shell of its own.
    <div>
      <div className="flex">
        {COLUMNS.map((column) => {
          const inColumn = posts.filter((p) => column.holds.includes(p.status));

          return (
            <section
              key={column.status}
              aria-label={column.label}
              className="-ml-px flex w-0 min-w-0 flex-1 flex-col border-l border-rule first:ml-0 first:border-l-0"
            >
              <div className="flex items-center gap-2 border-b border-rule px-4 py-3">
                {/* The Figma's column dot. It carries no state of its own, only
                    where in the pipeline this column sits, so it is a position
                    marker rather than a status and the word beside it is what
                    actually names the column. */}
                <span
                  aria-hidden
                  className={`size-1.5 shrink-0 rounded-chip ${COLUMN_DOT[column.status] ?? "bg-ink-3"}`}
                />
                <span className="legend flex-1 text-ink-2">{column.label}</span>
                <span className="meta text-ink-2">{pad2(inColumn.length)}</span>
              </div>

              <div className="flex flex-col gap-3 p-4">
                {inColumn.map((post) => (
                  <button
                    key={post.id}
                    onClick={() => onOpen(post)}
                    className={`settle lift flex flex-col gap-2 rounded-card border border-l-[3px] p-3 text-left hover:shadow-[0_2px_8px_rgb(27_21_38_/_0.09)] ${
                      post.status === "failed"
                        ? "border-red border-l-red bg-red-bg"
                        : post.status === "published"
                          ? "border-rule border-l-teal bg-sheet hover:bg-well"
                          : `border-rule bg-sheet hover:bg-well ${skillColour(post.skill).edge}`
                    }`}
                  >
                    <span
                      className={`legend flex items-center gap-1.5 ${
                        post.status === "failed" || post.status === "published"
                          ? "text-ink-2"
                          : skillColour(post.skill).text
                      }`}
                    >
                      {SKILL_BY_KEY[post.skill].name}
                      {/* Three statuses share the Needs review column, so each
                          card still says which one it is. Colour plus icon plus
                          word, DESIGN.md rule 9, because a column heading is
                          not a status. */}
                      {(() => {
                        const state = CARD_STATE[post.status];
                        if (!state) return null;
                        const { Icon } = state;
                        return (
                          <span className={`flex items-center gap-1 ${state.tone}`}>
                            <Icon size={11} strokeWidth={2} />
                            {state.word}
                          </span>
                        );
                      })()}
                    </span>
                    <span className="line-clamp-3 text-[13px] font-medium leading-[1.5]">
                      {post.hook}
                    </span>
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="record-id text-ink-3">{post.ref}</span>
                      <span className="meta text-ink-3">
                        {post.scheduled_for
                          ? `${dayLabel(post.scheduled_for, timezone)} ${timeOfDay(post.scheduled_for, timezone)}`
                          : "no date"}
                      </span>
                    </span>
                  </button>
                ))}

                {/* The Figma's per-column add, always mounted. Only on the
                    columns a human can actually put something into: Needs
                    review, Scheduled and Live are reached by moving a post
                    through, not by creating one there, and Live in particular
                    is a fact about LinkedIn rather than a place to write. */}
                {column.status === "idea" || column.status === "drafted" ? (
                  <button
                    type="button"
                    onClick={onAdd}
                    aria-label={`Add a post to ${column.label}`}
                    className="flex h-9 w-full items-center justify-center rounded-card border border-dashed border-rule text-ink-3 hover:border-violet hover:text-violet"
                  >
                    <span aria-hidden className="text-[15px] leading-none">+</span>
                  </button>
                ) : inColumn.length === 0 ? (
                  <p className="rounded-control border border-dashed border-rule px-3 py-6 text-center text-[12px] text-ink-3">
                    Nothing in {column.label.toLowerCase()} yet
                  </p>
                ) : null}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
