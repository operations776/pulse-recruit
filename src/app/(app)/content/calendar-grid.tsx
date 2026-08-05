"use client";

import { Check, Paperclip } from "lucide-react";
import { SKILL_BY_KEY } from "@/config/content-skills";
import type { PostRow } from "@/lib/supabase/types";
import { monthGrid, timeOfDay } from "@/lib/time";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// A published post is done, a scheduled one is still yours to change. The
// distinction is carried by weight and a rule, not by colour, because colour is
// spoken for by roles and a calendar full of tinted chips reads as noise.
function cardTone(post: PostRow): string {
  return post.status === "published"
    ? "border-rule bg-well text-ink-2"
    : "border-rule bg-sheet text-ink";
}

export function CalendarGrid({
  month,
  today,
  timezone,
  byDay,
  assetCount,
  draggingId,
  dropDay,
  onOpen,
  onAddOn,
  onDragStart,
  onDragEnd,
  onDropOn,
  onDragOverDay,
}: {
  month: string;
  today: string;
  timezone: string;
  byDay: Map<string, PostRow[]>;
  assetCount: (postId: string) => number;
  draggingId: string | null;
  dropDay: string | null;
  onOpen: (post: PostRow) => void;
  onAddOn: (day: string) => void;
  onDragStart: (postId: string) => void;
  onDragEnd: () => void;
  onDropOn: (day: string, postId: string) => void;
  onDragOverDay: (day: string | null) => void;
}) {
  const weeks = monthGrid(month);

  return (
    // No shell of its own: the planner owns the shell and this is a section
    // inside it, joined on the toolbar's bottom rule.
    <div>
      <div className="flex border-b border-rule">
        {WEEKDAYS.map((label) => (
          <div
            key={label}
            className="-ml-px flex-1 border-l border-rule px-3 py-2 first:ml-0 first:border-l-0"
          >
            <span className="legend text-ink-3">{label}</span>
          </div>
        ))}
      </div>

      {weeks.map((week, index) => (
        <div key={index} className="-mt-px flex border-t border-rule">
          {week.map((cell) => {
            const posts = byDay.get(cell.day) ?? [];
            const isToday = cell.day === today;
            const isDropTarget = draggingId !== null && dropDay === cell.day;

            return (
              <div
                key={cell.day}
                // Native HTML5 drag cannot be driven by Playwright's mouse
                // API, so the spec dispatches real DragEvents at these hooks.
                data-day={cell.day}
                onDragOver={(event) => {
                  if (!draggingId) return;
                  // Without preventDefault the browser refuses the drop.
                  event.preventDefault();
                  onDragOverDay(cell.day);
                }}
                onDragLeave={() => onDragOverDay(null)}
                onDrop={(event) => {
                  event.preventDefault();
                  // The id comes off the drag payload, not off React state.
                  // State set during dragstart has not necessarily committed by
                  // the time the drop handler runs, and the payload is what the
                  // drag actually carries.
                  onDropOn(cell.day, event.dataTransfer.getData("text/plain"));
                }}
                className={[
                  // 88px, not the old 104px: an empty cell held ~86px of air
                  // to show one date digit, and a month has ~30 of them. 88 is
                  // on the 8px scale; 104 was not.
                  "-ml-px flex min-h-[88px] w-0 flex-1 flex-col gap-1 border-l border-rule p-1.5 first:ml-0 first:border-l-0",
                  cell.inMonth ? "" : "bg-paper",
                  isDropTarget
                    ? "well outline outline-2 -outline-offset-2 outline-ink"
                    : "",
                ].join(" ")}
              >
                <button
                  onClick={() => onAddOn(cell.day)}
                  aria-label={`Plan a post on ${cell.day}`}
                  className={[
                    "meta self-start rounded-chip px-1.5 py-0.5 hover:bg-well hover:text-ink",
                    isToday
                      ? "bg-teal-bg text-teal-text"
                      : cell.inMonth
                        ? "text-ink-2"
                        : "text-ink-3",
                  ].join(" ")}
                >
                  {Number(cell.day.slice(8))}
                </button>

                <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto">
                  {posts.map((post) => {
                    const files = assetCount(post.id);
                    return (
                      <button
                        key={post.id}
                        draggable
                        onDragStart={(event) => {
                          event.dataTransfer.effectAllowed = "move";
                          event.dataTransfer.setData("text/plain", post.id);
                          onDragStart(post.id);
                        }}
                        onDragEnd={onDragEnd}
                        onClick={() => onOpen(post)}
                        title={SKILL_BY_KEY[post.skill].name}
                        className={[
                          "flex cursor-grab flex-col gap-1 rounded-card border p-2 text-left active:cursor-grabbing",
                          cardTone(post),
                          draggingId === post.id ? "opacity-40" : "",
                        ].join(" ")}
                      >
                        <span className="flex items-center gap-1.5">
                          {post.status === "published" ? (
                            // DESIGN.md rule 9: status is colour plus icon plus
                            // word. The strike through the hook is the shape
                            // cue, this is the word, and there is no room for a
                            // full chip in a cell this size.
                            <span className="meta flex items-center gap-1 text-teal-text">
                              <Check size={11} strokeWidth={2} />
                              Posted
                            </span>
                          ) : (
                            <span className="meta text-ink-3">
                              {post.scheduled_for
                                ? timeOfDay(post.scheduled_for, timezone)
                                : ""}
                            </span>
                          )}
                          {files > 0 ? (
                            <Paperclip
                              size={11}
                              strokeWidth={1.5}
                              className="text-ink-3"
                              aria-label={`${files} file${files === 1 ? "" : "s"}`}
                            />
                          ) : null}
                        </span>
                        <span
                          className={[
                            "line-clamp-2 text-[12px] font-medium leading-[1.4]",
                            post.status === "published" ? "line-through" : "",
                          ].join(" ")}
                        >
                          {post.hook}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
