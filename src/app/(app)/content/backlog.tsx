"use client";

import { CalendarPlus, Check, GripVertical, Plus, X } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { SKILLS, SKILL_BY_KEY, skillColour } from "@/config/content-skills";
import type { ContentSkill, PostRow } from "@/lib/supabase/types";
import { dayLabel, timeOfDay } from "@/lib/time";

type ListView = "ideas" | "all";
type SortBy = "due" | "az";

/**
 * The list under the grid: the ideas backlog, plus a flat all-posts view.
 *
 * Ideas is the default tab, because scheduled posts already sit on the grid and
 * listing them twice read as duplicates. All posts exists for the moments you
 * want the month as a sortable schedule instead of squares.
 *
 * Drag a row onto a day above to schedule it. Drag is the fast path, not the
 * only path: every idea row also carries a date control, because DESIGN.md
 * section 2 says nothing lives behind hover and a drag-only interaction is
 * unusable with a keyboard.
 */
export function Backlog({
  posts,
  allPosts,
  timezone,
  draggingId,
  onOpen,
  onSchedule,
  onQuickAdd,
  onDragStart,
  onDragEnd,
  adding,
}: {
  posts: PostRow[];
  allPosts: PostRow[];
  timezone: string;
  draggingId: string | null;
  onOpen: (post: PostRow) => void;
  onSchedule: (postId: string, day: string) => void;
  onQuickAdd: (skill: ContentSkill, hook: string, day: string) => void;
  onDragStart: (postId: string) => void;
  onDragEnd: () => void;
  adding: boolean;
}) {
  const [view, setView] = useState<ListView>("ideas");
  const [sortBy, setSortBy] = useState<SortBy>("due");

  const listed = useMemo(() => {
    const source = view === "ideas" ? posts : allPosts;
    return [...source].sort((a, b) => {
      if (sortBy === "az") return a.hook.localeCompare(b.hook);
      // Due date: undated last, because a schedule reads forward in time and
      // the ideas have not joined it yet.
      const ad = a.scheduled_for ? new Date(a.scheduled_for).getTime() : Infinity;
      const bd = b.scheduled_for ? new Date(b.scheduled_for).getTime() : Infinity;
      return ad - bd || a.hook.localeCompare(b.hook);
    });
  }, [view, sortBy, posts, allPosts]);

  const tab = (key: ListView, label: string, count: number) => (
    <button
      onClick={() => setView(key)}
      aria-pressed={view === key}
      className={`legend flex h-7 items-center gap-1.5 rounded-control px-3 ${
        view === key
          ? "cap bg-vermilion text-on-vermilion [--edge:var(--color-vermilion-edge)]"
          : "text-ink-2 hover:text-ink"
      }`}
    >
      {label}
      <span className={view === key ? "opacity-80" : "text-ink-3"}>
        {String(count).padStart(2, "0")}
      </span>
    </button>
  );

  return (
    // A section of the planner shell now, not a shell of its own. DESIGN.md
    // section 7: sections inside a shell meet on a 1px rule with no gap and no
    // radius, and only the shell's outer corners are rounded.
    <section className="border-t border-rule">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-rule px-4 py-2">
        <div className="well flex gap-1 rounded-control p-1">
          {tab("ideas", "Ideas", posts.length)}
          {tab("all", "All posts", allPosts.length)}
        </div>
        <p className="text-[12px] text-ink-2">
          {view === "ideas"
            ? "No date yet. Drag one onto a day, or set a date on the row."
            : "The whole month as a flat schedule."}
        </p>
        <div className="ml-auto flex items-center gap-1.5">
          {(
            [
              ["due", "Due date"],
              ["az", "A to Z"],
            ] as [SortBy, string][]
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setSortBy(key)}
              aria-pressed={sortBy === key}
              className={`legend flex h-7 items-center rounded-control px-2.5 ${
                sortBy === key
                  ? "bg-well text-ink"
                  : "text-ink-3 hover:text-ink"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <QuickAddRow onAdd={onQuickAdd} adding={adding} />

      {listed.length === 0 ? (
        // One line on the shared rule, not 32px of centred padding around a
        // sentence. Same shape as the empty states in /ops/tasks.
        <p className="px-4 py-3 text-[12px] text-ink-3">
          {view === "ideas"
            ? "Nothing waiting. Park the next idea above before it escapes."
            : "No posts yet this month."}
        </p>
      ) : (
        <ul>
          {listed.map((post) => (
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
                "settle -mt-px flex cursor-grab flex-wrap items-center gap-x-3 gap-y-2 border-t border-l-[3px] border-rule px-4 py-2.5 first:mt-0 first:border-t-0 active:cursor-grabbing hover:bg-paper",
                // The skill accent, same language as the calendar card, so a
                // post keeps its colour when it moves between the two.
                skillColour(post.skill).edge,
                draggingId === post.id ? "opacity-40" : "",
              ].join(" ")}
            >
              <GripVertical
                size={16}
                strokeWidth={1.5}
                className="shrink-0 text-ink-3"
                aria-hidden
              />

              <span
                className={`legend w-28 shrink-0 ${skillColour(post.skill).text}`}
              >
                {SKILL_BY_KEY[post.skill].name}
              </span>

              <button
                onClick={() => onOpen(post)}
                className="min-w-[12rem] flex-1 truncate text-left text-[13px] font-medium hover:text-vermilion"
              >
                {post.hook}
              </button>

              {/* The due chip keeps the list scanning like a schedule. Colour
                  plus icon plus word when it means something (rule 9). */}
              {post.scheduled_for ? (
                <span
                  className={`meta flex shrink-0 items-center gap-1 rounded-chip border px-1.5 py-0.5 ${
                    post.status === "published"
                      ? "border-teal bg-teal-bg text-teal-text"
                      : "border-rule bg-paper text-ink-2"
                  }`}
                >
                  {post.status === "published" ? (
                    <Check size={11} strokeWidth={2} />
                  ) : null}
                  {dayLabel(post.scheduled_for, timezone)}{" "}
                  {timeOfDay(post.scheduled_for, timezone)}
                </span>
              ) : (
                <span className="meta shrink-0 rounded-chip border border-rule bg-paper px-1.5 py-0.5 text-ink-3">
                  no date
                </span>
              )}

              <span className="record-id shrink-0 text-ink-3">{post.ref}</span>

              {!post.scheduled_for ? (
                <DateControl
                  postId={post.id}
                  onSchedule={onSchedule}
                  label={post.hook}
                />
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * Frictionless capture: hook, shape, optional date, Enter. The date being
 * optional is the point, because an idea dies while you are deciding when to
 * post it.
 */
function QuickAddRow({
  onAdd,
  adding,
}: {
  onAdd: (skill: ContentSkill, hook: string, day: string) => void;
  adding: boolean;
}) {
  const [hook, setHook] = useState("");
  const [skill, setSkill] = useState<ContentSkill>(SKILLS[0].key);
  const [day, setDay] = useState("");

  const submit = () => {
    const trimmed = hook.trim();
    if (!trimmed) return;
    onAdd(skill, trimmed, day);
    setHook("");
    setDay("");
  };

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-rule bg-paper px-4 py-2.5">
      <Input
        value={hook}
        aria-label="New idea hook"
        placeholder="Park an idea: the hook, in your own words"
        onChange={(event) => setHook(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") submit();
        }}
        className="h-8 min-w-[14rem] flex-1"
      />
      <Select
        aria-label="Skill"
        value={skill}
        onChange={(event) => setSkill(event.target.value as ContentSkill)}
        className="h-8 w-36 shrink-0 text-[12px]"
      >
        {SKILLS.map((s) => (
          <option key={s.key} value={s.key}>
            {s.name}
          </option>
        ))}
      </Select>
      <Input
        type="date"
        aria-label="Date, optional"
        title="Optional. Leave empty to park it in the backlog."
        value={day}
        onChange={(event) => setDay(event.target.value)}
        className="h-8 w-36 shrink-0"
      />
      <Button onClick={submit} disabled={adding || !hook.trim()}>
        <Plus size={16} strokeWidth={2} />
        Add idea
      </Button>
    </div>
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
