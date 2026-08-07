"use client";

import Link from "next/link";
import { PenLine, Sparkles, UserRound } from "lucide-react";
import type { PostRow } from "@/lib/supabase/types";

/**
 * The content rail, from the Figma's left column.
 *
 * Planner, then the three queues a recruiter actually navigates by, then the
 * two rooms where the writing is configured. It is owned by the page rather
 * than by `modules.ts` because every entry carries a live count, and a count
 * cannot live in a static config.
 *
 * CONTENT dropped to one module destination in the same change, so the module
 * rail's section column no longer renders and this sits directly beside the
 * icon rail. Two nav columns plus a list is the four-column defect PLS-99 was
 * filed for; the rule that prevents it is `nav.length <= 1` in module-rail.tsx.
 *
 * A count of zero is not printed. An empty queue is not news, and a rail full
 * of grey zeroes reads as a broken screen rather than a quiet week.
 */

export type ContentFilter = "all" | "needs-you" | "ideas" | "published";

/** Everything a human has to look at before it can go out. */
export function needsYou(posts: PostRow[]): PostRow[] {
  return posts.filter(
    (p) =>
      p.status === "needs_review" ||
      p.status === "needs_attention" ||
      p.status === "failed",
  );
}

export function ContentRail({
  filter,
  posts,
  skillCount,
  hasPersona,
  pendingLessons,
}: {
  filter: ContentFilter;
  posts: PostRow[];
  skillCount: number;
  hasPersona: boolean;
  /** Edits the voice has not learned from yet. Real work, so it is counted. */
  pendingLessons: number;
}) {
  const counts: Record<ContentFilter, number> = {
    all: 0,
    "needs-you": needsYou(posts).length,
    ideas: posts.filter((p) => p.status === "idea").length,
    published: posts.filter((p) => p.status === "published").length,
  };

  const entry = (
    key: string,
    href: string,
    label: string,
    count: number,
    active: boolean,
  ) => (
    <li key={key}>
      <Link
        href={href}
        prefetch
        aria-current={active ? "page" : undefined}
        className={`flex h-8 items-center gap-2.5 rounded-control px-2.5 ${
          active
            ? "bg-well font-medium text-ink"
            : "text-ink-2 hover:bg-well hover:text-ink"
        }`}
      >
        <span
          aria-hidden
          className={`size-1.5 shrink-0 rounded-chip ${
            active ? "bg-violet" : "bg-ink-3"
          }`}
        />
        <span className="min-w-0 flex-1 truncate text-[13px]">{label}</span>
        {count > 0 ? <span className="meta text-ink-3">{count}</span> : null}
      </Link>
    </li>
  );

  return (
    <nav
      aria-label="Content views"
      className="flex w-56 shrink-0 flex-col overflow-y-auto border-r border-rule bg-sheet"
    >
      <ul className="flex flex-col gap-0.5 p-2">
        {entry("all", "/content", "Planner", 0, filter === "all")}
        {entry(
          "needs-you",
          "/content?filter=needs-you",
          "Needs you",
          counts["needs-you"],
          filter === "needs-you",
        )}
        {entry(
          "ideas",
          "/content?filter=ideas",
          "Ideas",
          counts.ideas,
          filter === "ideas",
        )}
        {entry(
          "published",
          "/content?filter=published",
          "Published",
          counts.published,
          filter === "published",
        )}
      </ul>

      {/* The Figma's second group. These are not queues of work, they are
          where the writing gets configured, so they are separated rather than
          listed alongside. */}
      <p className="legend px-3 pb-1 pt-2 text-ink-3">How it writes</p>
      <ul className="flex flex-col gap-0.5 px-2 pb-3">
        <li>
          <Link
            href="/content/persona"
            prefetch
            className={`flex h-8 items-center gap-2.5 rounded-control px-2.5 text-[13px] ${
              hasPersona
                ? "text-ink-2 hover:bg-well hover:text-ink"
                : // An unbuilt voice is what makes every draft generic, so it
                  // is stated here rather than discovered after a bad draft.
                  "text-amber-text hover:bg-well"
            }`}
          >
            <UserRound size={15} strokeWidth={1.75} />
            <span className="min-w-0 flex-1 truncate">
              {hasPersona ? "Your voice" : "Build your voice"}
            </span>
            {pendingLessons > 0 ? (
              <span className="meta text-amber-text">{pendingLessons}</span>
            ) : null}
          </Link>
        </li>
        <li>
          {/* PLS-188: the full screen the frame gives Skills. */}
          <Link
            href="/content/skills"
            prefetch
            className="flex h-8 w-full items-center gap-2.5 rounded-control px-2.5 text-left text-[13px] text-ink-2 hover:bg-well hover:text-ink"
          >
            <Sparkles size={15} strokeWidth={1.75} />
            <span className="min-w-0 flex-1 truncate">Skills</span>
            {skillCount > 0 ? (
              <span className="meta text-ink-3">{skillCount}</span>
            ) : null}
          </Link>
        </li>
      </ul>

      <p className="legend mt-auto flex items-center gap-1.5 px-3 pb-3 text-ink-3">
        <PenLine size={12} strokeWidth={1.75} />
        Pillar 5
      </p>
    </nav>
  );
}
