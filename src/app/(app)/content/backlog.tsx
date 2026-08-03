"use client";

import { CalendarPlus, GripVertical, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SKILL_BY_KEY } from "@/config/content-skills";
import type { PostRow } from "@/lib/supabase/types";

/**
 * The undated posts.
 *
 * Drag one onto a day above to schedule it. Drag is the fast path, not the only
 * path: every row also carries a date control, because DESIGN.md section 2 says
 * nothing lives behind hover and a drag-only interaction is unusable with a
 * keyboard.
 */
export function Backlog({
  posts,
  draggingId,
  onOpen,
  onSchedule,
  onDragStart,
  onDragEnd,
}: {
  posts: PostRow[];
  draggingId: string | null;
  onOpen: (post: PostRow) => void;
  onSchedule: (postId: string, day: string) => void;
  onDragStart: (postId: string) => void;
  onDragEnd: () => void;
}) {
  return (
    <section className="overflow-hidden rounded-shell border border-rule bg-sheet">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-rule px-4 py-3">
        <span className="legend text-ink-2">Backlog</span>
        <span className="meta text-ink-3">
          {String(posts.length).padStart(2, "0")}
        </span>
        <p className="text-[12px] text-ink-2">
          Ideas with no date yet. Drag one onto a day, or set a date on the row.
        </p>
      </div>

      {posts.length === 0 ? (
        <p className="px-4 py-8 text-center text-[12px] text-ink-3">
          Nothing waiting. Every idea you have written down is on the calendar.
        </p>
      ) : (
        <ul>
          {posts.map((post) => (
            <li
              key={post.id}
              data-post={post.ref}
              draggable
              onDragStart={(event) => {
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData("text/plain", post.id);
                onDragStart(post.id);
              }}
              onDragEnd={onDragEnd}
              className={[
                "-mt-px flex cursor-grab flex-wrap items-center gap-x-3 gap-y-2 border-t border-rule px-4 py-2.5 first:mt-0 first:border-t-0 active:cursor-grabbing",
                draggingId === post.id ? "opacity-40" : "",
              ].join(" ")}
            >
              <GripVertical
                size={16}
                strokeWidth={1.5}
                className="shrink-0 text-ink-3"
                aria-hidden
              />

              <span className="legend w-28 shrink-0 text-ink-3">
                {SKILL_BY_KEY[post.skill].name}
              </span>

              <button
                onClick={() => onOpen(post)}
                className="min-w-[12rem] flex-1 truncate text-left text-[13px] font-medium hover:text-vermilion"
              >
                {post.hook}
              </button>

              <span className="record-id shrink-0 text-ink-3">{post.ref}</span>

              <DateControl
                postId={post.id}
                onSchedule={onSchedule}
                label={post.hook}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** The keyboard path to the same thing dragging does. */
function DateControl({
  postId,
  label,
  onSchedule,
}: {
  postId: string;
  label: string;
  onSchedule: (postId: string, day: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [day, setDay] = useState("");

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} aria-label={`Set a date for ${label}`}>
        <CalendarPlus size={16} strokeWidth={1.5} />
        Set a date
      </Button>
    );
  }

  return (
    <span className="flex shrink-0 items-center gap-2">
      <Input
        type="date"
        value={day}
        aria-label="Date"
        autoFocus
        onChange={(event) => setDay(event.target.value)}
        className="w-40"
      />
      {/* Secondary, not primary. DESIGN.md section 3 allows one vermilion
          control per view and the page header already spends it on New post. */}
      <Button
        disabled={!day}
        onClick={() => {
          onSchedule(postId, day);
          setOpen(false);
          setDay("");
        }}
      >
        Set
      </Button>
      <button
        onClick={() => setOpen(false)}
        aria-label="Cancel"
        className="flex size-7 items-center justify-center rounded-control text-ink-3 hover:bg-well hover:text-ink"
      >
        <X size={16} strokeWidth={1.5} />
      </button>
    </span>
  );
}
