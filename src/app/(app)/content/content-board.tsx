"use client";

import { SKILL_BY_KEY } from "@/config/content-skills";
import type { PostRow, PostStatus } from "@/lib/supabase/types";
import { dayLabel, timeOfDay } from "@/lib/time";

// The board reads left to right in the order a post actually travels. It shows
// the same rows the calendar does, arranged by state rather than by date, which
// is the view you want when triaging a pile of ideas rather than planning a
// week. All of the writing happens in the drawer the planner owns, so this file
// is presentation only.
const COLUMNS: { status: PostStatus; label: string }[] = [
  { status: "idea", label: "Idea" },
  { status: "drafted", label: "Drafted" },
  { status: "scheduled", label: "Scheduled" },
  { status: "published", label: "Published" },
];

const pad2 = (n: number) => String(n).padStart(2, "0");

export function StatusBoard({
  posts,
  timezone,
  onOpen,
}: {
  posts: PostRow[];
  timezone: string;
  onOpen: (post: PostRow) => void;
}) {
  return (
    // Section inside the planner shell, not a shell of its own.
    <div>
      <div className="flex">
        {COLUMNS.map((column) => {
          const inColumn = posts.filter((p) => p.status === column.status);

          return (
            <section
              key={column.status}
              aria-label={column.label}
              className="-ml-px flex w-0 min-w-0 flex-1 flex-col border-l border-rule first:ml-0 first:border-l-0"
            >
              <div className="flex items-center gap-3 border-b border-rule px-4 py-3">
                <span className="legend flex-1 text-ink-2">{column.label}</span>
                <span className="meta text-ink-2">{pad2(inColumn.length)}</span>
              </div>

              <div className="flex flex-col gap-3 p-4">
                {inColumn.map((post) => (
                  <button
                    key={post.id}
                    onClick={() => onOpen(post)}
                    className="flex flex-col gap-2 rounded-card border border-rule bg-sheet p-3 text-left hover:bg-well"
                  >
                    <span className="legend text-ink-2">
                      {SKILL_BY_KEY[post.skill].name}
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

                {inColumn.length === 0 ? (
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
