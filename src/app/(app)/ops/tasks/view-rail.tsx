"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Avatar } from "@/components/ui/avatar";
import type { OrgMember } from "@/lib/supabase/types";
import { TASK_VIEWS, type TaskViewKey } from "@/lib/tasks";

/**
 * The left column of the workspace: which slice of the list you are looking at.
 *
 * It deliberately does not repeat the masthead the Figma frame draws at its
 * top. The module rail two columns to the left already says PILLAR 2 / OPS, and
 * PLS-99 is the ticket that exists because the BD workspace printed its pillar
 * name beside the rail that was already printing it.
 *
 * Every entry is a link, not a button. A view is a place: it survives a reload,
 * it can be pasted to a teammate, and the back button behaves.
 */
export function ViewRail({
  view,
  person,
  counts,
  personCounts,
  members,
  meId,
}: {
  view: TaskViewKey;
  person: string | null;
  counts: Record<TaskViewKey, number>;
  personCounts: Record<string, number>;
  members: OrgMember[];
  meId: string;
}) {
  const views = TASK_VIEWS.filter((v) => v.group === "views");
  const saved = TASK_VIEWS.filter((v) => v.group === "saved");

  const entry = (
    key: string,
    href: string,
    label: string,
    count: number,
    active: boolean,
    leading?: ReactNode,
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
        {leading ?? (
          <span
            aria-hidden
            className={`size-1.5 shrink-0 rounded-chip ${
              active ? "bg-violet" : "bg-ink-3"
            }`}
          />
        )}
        <span className="min-w-0 flex-1 truncate text-[13px]">{label}</span>
        {count > 0 ? <span className="meta text-ink-3">{count}</span> : null}
      </Link>
    </li>
  );

  return (
    <nav
      aria-label="Task views"
      className="flex w-56 shrink-0 flex-col overflow-y-auto border-r border-rule bg-sheet"
    >
      <ul className="flex flex-col gap-0.5 p-2">
        {views.map((v) =>
          entry(
            v.key,
            `/ops/tasks?view=${v.key}`,
            v.label,
            counts[v.key],
            view === v.key && !person,
          ),
        )}
      </ul>

      <p className="legend px-3 pb-1 pt-2 text-ink-3">By person</p>
      <ul className="flex flex-col gap-0.5 px-2 pb-2">
        {members.map((m) =>
          entry(
            m.user_id,
            `/ops/tasks?person=${m.user_id}`,
            m.user_id === meId ? "You" : m.display_name,
            personCounts[m.user_id] ?? 0,
            person === m.user_id,
            <Avatar name={m.display_name} size="sm" />,
          ),
        )}
      </ul>

      {/* Not a saved-views table. Two predicates with names on them, which is
          what these are: a table would only let somebody save a third one that
          nothing on this screen reads. */}
      <p className="legend px-3 pb-1 pt-2 text-ink-3">Saved views</p>
      <ul className="flex flex-col gap-0.5 px-2 pb-3">
        {saved.map((v) =>
          entry(
            v.key,
            `/ops/tasks?view=${v.key}`,
            v.label,
            counts[v.key],
            view === v.key && !person,
          ),
        )}
      </ul>
    </nav>
  );
}
