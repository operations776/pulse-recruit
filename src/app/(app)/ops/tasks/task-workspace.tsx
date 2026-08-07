"use client";

import { SlidersHorizontal } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Popover } from "@/components/ui/popover";
import { completeTask } from "@/lib/actions";
import type { TaskLink } from "@/lib/data";
import type {
  OrgMember,
  TaskCommentRow,
  TaskRow,
} from "@/lib/supabase/types";
import {
  dueBucket,
  matchesView,
  PRIORITY_RANK,
  RANK_TO_PRIORITY,
  priorityLabel,
  TASK_VIEWS,
  type DueBucket,
  type TaskViewKey,
} from "@/lib/tasks";
import { dayKey, dayLabel } from "@/lib/time";
import { QuickAdd } from "./quick-add";
import { TaskListRow } from "./task-row";
import { TaskPanel } from "./task-panel";
import { ViewRail } from "./view-rail";

/** The completed list pages in tens, per its own spec. */
const COMPLETED_PAGE = 10;

/** How long a finished row stays in place with Undo on it. */
const GRACE_MS = 4000;

/** The height collapse that hands the row to the completed group. */
const COLLAPSE_MS = 200;

/** A Set minus one member, since Set state has to be replaced rather than mutated. */
function without(set: Set<string>, id: string): Set<string> {
  const next = new Set(set);
  next.delete(id);
  return next;
}

export function TaskWorkspace({
  view,
  person,
  selectedId,
  tasks,
  assigneesByTask,
  watchersByTask,
  members,
  meId,
  isAdmin,
  noteCounts,
  links,
  activity,
  tz,
  todayKey,
}: {
  view: TaskViewKey;
  person: string | null;
  selectedId: string | null;
  tasks: TaskRow[];
  assigneesByTask: Record<string, string[]>;
  watchersByTask: Record<string, string[]>;
  members: OrgMember[];
  meId: string;
  isAdmin: boolean;
  noteCounts: Record<string, number>;
  links: TaskLink[];
  activity: TaskCommentRow[];
  tz: string;
  todayKey: string;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const tomorrowKey = useMemo(() => addDay(todayKey), [todayKey]);

  /* --- optimistic completion ------------------------------------------------
   *
   * Three pieces of state, because a finished row passes through three
   * conditions and they do not begin or end together. `done` decides which
   * group it counts towards and it flips on click, which is what makes the
   * group count decrement immediately rather than four seconds later.
   * `graced` keeps it rendered in place with Undo on it. `collapsing` is the
   * 200ms of height on the way out.
   */
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [graced, setGraced] = useState<Set<string>>(new Set());
  const [collapsing, setCollapsing] = useState<Set<string>>(new Set());
  const [rowError, setRowError] = useState<Record<string, string>>({});

  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const lastCompleted = useRef<string | null>(null);

  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const timer of pending.values()) clearTimeout(timer);
      pending.clear();
    };
  }, []);

  // The ref is stable, so this never needs to change identity and the two
  // callbacks below can depend on it without re-creating themselves every
  // render and restarting nothing in particular.
  const clearTimers = useCallback((id: string) => {
    for (const key of [`${id}:grace`, `${id}:collapse`]) {
      const timer = timers.current.get(key);
      if (timer) clearTimeout(timer);
      timers.current.delete(key);
    }
  }, []);

  const doneOf = useCallback(
    (task: TaskRow) => done[task.id] ?? task.status === "completed",
    [done],
  );

  const undo = useCallback(
    (task: TaskRow) => {
      clearTimers(task.id);
      setGraced((s) => without(s, task.id));
      setCollapsing((s) => without(s, task.id));
      setDone((s) => ({ ...s, [task.id]: false }));
      if (lastCompleted.current === task.id) lastCompleted.current = null;

      startTransition(async () => {
        const result = await completeTask(task.id, false);
        if (!result.ok) {
          setDone((s) => ({ ...s, [task.id]: true }));
          setRowError((s) => ({ ...s, [task.id]: result.error }));
          return;
        }
        router.refresh();
      });
    },
    [router, clearTimers],
  );

  const complete = useCallback(
    (task: TaskRow) => {
      setDone((s) => ({ ...s, [task.id]: true }));
      setGraced((s) => new Set(s).add(task.id));
      setRowError((s) => ({ ...s, [task.id]: "" }));
      lastCompleted.current = task.id;

      timers.current.set(
        `${task.id}:grace`,
        setTimeout(() => {
          setCollapsing((s) => new Set(s).add(task.id));
          timers.current.set(
            `${task.id}:collapse`,
            setTimeout(() => {
              setGraced((s) => without(s, task.id));
              setCollapsing((s) => without(s, task.id));
              if (lastCompleted.current === task.id) lastCompleted.current = null;
              // Reconcile: done_at and done_by are the server's to decide, and
              // the completed group prints both.
              router.refresh();
            }, COLLAPSE_MS),
          );
        }, GRACE_MS),
      );

      startTransition(async () => {
        const result = await completeTask(task.id, true);
        if (!result.ok) {
          clearTimers(task.id);
          setDone((s) => ({ ...s, [task.id]: false }));
          setGraced((s) => without(s, task.id));
          // Quiet and inline, never a modal: the row is what they were
          // looking at when it failed.
          setRowError((s) => ({ ...s, [task.id]: result.error }));
        }
      });
    },
    [router, clearTimers],
  );

  const toggle = (task: TaskRow, next: boolean) => {
    if (next) complete(task);
    else undo(task);
  };

  // Cmd+Z inside the grace window, per the completion spec.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "z" || !(event.metaKey || event.ctrlKey)) return;
      const id = lastCompleted.current;
      if (!id) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) {
        return;
      }
      const task = tasks.find((t) => t.id === id);
      if (!task) return;
      event.preventDefault();
      undo(task);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [tasks, undo]);

  /* --- filters and grouping ------------------------------------------------- */

  const [grouping, setGrouping] = useState<"date" | "priority">("date");
  const [ranks, setRanks] = useState<Set<number>>(new Set());
  const [claudeOnly, setClaudeOnly] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const [completedShown, setCompletedShown] = useState(COMPLETED_PAGE);

  const bucketOf = useCallback(
    (task: TaskRow): DueBucket =>
      dueBucket(task.due, todayKey, tomorrowKey, tz),
    [todayKey, tomorrowKey, tz],
  );

  const ownersOf = useCallback(
    (task: TaskRow) => assigneesByTask[task.id] ?? [],
    [assigneesByTask],
  );

  const linkOf = useCallback(
    (task: TaskRow) =>
      links.find((l) =>
        task.candidate_id
          ? l.kind === "candidate" && l.id === task.candidate_id
          : task.company_id
            ? l.kind === "company" && l.id === task.company_id
            : false,
      ) ?? null,
    [links],
  );

  /** For prose. "You" reads better than your own name in a sentence. */
  const nameOf = useCallback(
    (userId: string) =>
      userId === meId
        ? "You"
        : (members.find((m) => m.user_id === userId)?.display_name ?? "Teammate"),
    [members, meId],
  );

  /**
   * For avatars, which take initials.
   *
   * nameOf was feeding both, so your own tile rendered a single "Y" from the
   * word "You". An avatar is an identity, not a pronoun: it should say DA the
   * way the design does, and the way every teammate's already did.
   */
  const tileNameOf = useCallback(
    (userId: string) =>
      members.find((m) => m.user_id === userId)?.display_name ?? "Teammate",
    [members],
  );

  // Counts for the rail. Open work only, and computed off the same predicate
  // the list uses, so a rail that says 5 cannot open onto a list of 4.
  const counts = useMemo(() => {
    const out = Object.fromEntries(
      TASK_VIEWS.map((v) => [v.key, 0]),
    ) as Record<TaskViewKey, number>;
    for (const task of tasks) {
      if (doneOf(task)) continue;
      const bucket = bucketOf(task);
      const owners = ownersOf(task);
      for (const v of TASK_VIEWS) {
        if (matchesView(task, v.key, bucket, owners)) out[v.key] += 1;
      }
    }
    return out;
  }, [tasks, doneOf, bucketOf, ownersOf]);

  const personCounts = useMemo(() => {
    const out: Record<string, number> = {};
    for (const task of tasks) {
      if (doneOf(task)) continue;
      for (const owner of ownersOf(task)) {
        out[owner] = (out[owner] ?? 0) + 1;
      }
    }
    return out;
  }, [tasks, doneOf, ownersOf]);

  const passesFilters = useCallback(
    (task: TaskRow) => {
      if (claudeOnly && task.origin !== "claude") return false;
      if (ranks.size > 0 && !ranks.has(PRIORITY_RANK[task.priority])) return false;
      return true;
    },
    [claudeOnly, ranks],
  );

  // The open list. A row inside its grace window is still here: it was
  // completed, it is struck through, and it has not left yet.
  const openTasks = useMemo(
    () =>
      tasks.filter((task) => {
        if (doneOf(task) && !graced.has(task.id)) return false;
        if (!passesFilters(task)) return false;
        const owners = ownersOf(task);
        if (person) return owners.includes(person);
        return matchesView(task, view, bucketOf(task), owners);
      }),
    [tasks, doneOf, graced, passesFilters, ownersOf, person, view, bucketOf],
  );

  // Scoped to the person and the filters, but not to the dated views: a
  // finished task has no useful answer to "is it due tomorrow", so grouping it
  // by when it was done is the only view where completion time matters.
  const completedTasks = useMemo(
    () =>
      tasks
        .filter(
          (task) =>
            doneOf(task) &&
            !graced.has(task.id) &&
            task.done_at &&
            passesFilters(task) &&
            (person ? ownersOf(task).includes(person) : true),
        )
        .sort((a, b) => (b.done_at ?? "").localeCompare(a.done_at ?? "")),
    [tasks, doneOf, graced, passesFilters, person, ownersOf],
  );

  const groups = useMemo(() => {
    const map = new Map<string, { label: string; sort: string; tasks: TaskRow[] }>();
    for (const task of openTasks) {
      const { key, label, sort } =
        grouping === "priority"
          ? priorityGroup(task)
          : dateGroup(task, bucketOf(task), tz);
      const bucket = map.get(key) ?? { label, sort, tasks: [] };
      bucket.tasks.push(task);
      map.set(key, bucket);
    }
    return [...map.values()].sort((a, b) => a.sort.localeCompare(b.sort));
  }, [openTasks, grouping, bucketOf, tz]);

  const completedGroups = useMemo(() => {
    const map = new Map<string, { label: string; tasks: TaskRow[] }>();
    for (const task of completedTasks.slice(0, completedShown)) {
      const key = dayKey(task.done_at!, tz);
      const label =
        key === todayKey
          ? "Today"
          : key === addDay(todayKey, -1)
            ? "Yesterday"
            : dayLabel(task.done_at!, tz);
      const bucket = map.get(key) ?? { label, tasks: [] };
      bucket.tasks.push(task);
      map.set(key, bucket);
    }
    // Newest first: that is the only view where completion time matters.
    return [...map.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([, value]) => value);
  }, [completedTasks, completedShown, tz, todayKey]);

  const openCount = openTasks.filter((t) => !doneOf(t)).length;
  const overdueCount = openTasks.filter(
    (t) => !doneOf(t) && bucketOf(t) === "overdue",
  ).length;

  const selected = selectedId
    ? (tasks.find((t) => t.id === selectedId) ?? null)
    : null;

  const go = (params: Record<string, string | null>) => {
    const search = new URLSearchParams();
    if (person) search.set("person", person);
    else search.set("view", view);
    if (selectedId) search.set("task", selectedId);
    for (const [key, value] of Object.entries(params)) {
      if (value === null) search.delete(key);
      else search.set(key, value);
    }
    router.push(`/ops/tasks?${search.toString()}`);
  };

  const heading = person
    ? nameOf(person)
    : (TASK_VIEWS.find((v) => v.key === view)?.label ?? "Tasks");

  return (
    <div className="flex min-w-0 flex-1 overflow-hidden bg-paper">
      <ViewRail
        view={view}
        person={person}
        counts={counts}
        personCounts={personCounts}
        members={members}
        meId={meId}
      />

      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* The rule spans the full width, the content inside it does not.
            Capping the list without capping this left the title at one x and
            the first row at another, which reads as two panels rather than one
            screen. The band still crosses the whole main area, because a
            divider that stops short of its own edges is a worse artefact than
            the misalignment it was fixing. */}
        <header className="border-b border-rule px-6 py-3">
          <div className="mx-auto flex w-full max-w-[900px] items-center justify-between gap-4">
          <div className="min-w-0">
            <h1 className="display text-[18px] leading-none">{heading}</h1>
            <p className="meta mt-1.5 text-ink-2">
              {openCount} open{overdueCount > 0 ? `, ${overdueCount} of them overdue` : ""}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {/* Faster than the rail for a one-click switch, and it clears by
                clicking the person who is already on. */}
            <span className="flex items-center gap-1">
              {members.map((m) => (
                <button
                  key={m.user_id}
                  type="button"
                  title={m.display_name}
                  aria-pressed={person === m.user_id}
                  onClick={() =>
                    router.push(
                      person === m.user_id
                        ? `/ops/tasks?view=${view}`
                        : `/ops/tasks?person=${m.user_id}`,
                    )
                  }
                  // p-1 around a 20px tile is what gets this to the 28px floor.
                  className={`settle flex size-7 items-center justify-center rounded-card ${
                    person === m.user_id
                      ? "ring-2 ring-violet"
                      : "opacity-60 hover:opacity-100"
                  }`}
                >
                  <Avatar name={m.display_name} size="sm" />
                </button>
              ))}
            </span>

            <span className="relative">
              <button
                type="button"
                onClick={() => setFilterOpen((v) => !v)}
                aria-expanded={filterOpen}
                className={`cap flex h-7 items-center gap-1.5 rounded-control border px-2.5 text-[12px] font-medium [--edge:var(--color-ink)] ${
                  ranks.size > 0 || claudeOnly
                    ? "border-violet text-violet"
                    : "border-ink text-ink hover:bg-well"
                }`}
              >
                <SlidersHorizontal size={13} strokeWidth={1.75} />
                Filter
                {ranks.size > 0 || claudeOnly ? (
                  <span className="meta">{ranks.size + (claudeOnly ? 1 : 0)}</span>
                ) : null}
              </button>
              <Popover
                open={filterOpen}
                onClose={() => setFilterOpen(false)}
                label="Filter tasks"
                width={200}
              >
                <p className="legend mb-2 text-ink-3">Priority</p>
                {[1, 2, 3, 4].map((rank) => (
                  <label
                    key={rank}
                    className="flex cursor-pointer items-center gap-2 py-1 text-[13px] text-ink"
                  >
                    <input
                      type="checkbox"
                      checked={ranks.has(rank)}
                      onChange={() =>
                        setRanks((s) => {
                          const next = new Set(s);
                          if (next.has(rank)) next.delete(rank);
                          else next.add(rank);
                          return next;
                        })
                      }
                      className="accent-violet"
                    />
                    {priorityLabel(RANK_TO_PRIORITY[rank])}
                  </label>
                ))}
                <p className="legend mb-2 mt-3 border-t border-rule pt-3 text-ink-3">
                  Origin
                </p>
                <label className="flex cursor-pointer items-center gap-2 py-1 text-[13px] text-ink">
                  <input
                    type="checkbox"
                    checked={claudeOnly}
                    onChange={() => setClaudeOnly((v) => !v)}
                    className="accent-violet"
                  />
                  Created by Claude
                </label>
              </Popover>
            </span>

            {/* One control that alternates, PLS-90. Two buttons where only one
                can ever apply is the pattern that ticket removed. */}
            <button
              type="button"
              onClick={() =>
                setGrouping((g) => (g === "date" ? "priority" : "date"))
              }
              className="cap flex h-7 items-center rounded-control border border-ink px-2.5 text-[12px] font-medium text-ink [--edge:var(--color-ink)] hover:bg-well"
            >
              {grouping === "date" ? "Group by date" : "Group by priority"}
            </button>
          </div>
          </div>
        </header>

        {/* The list is capped rather than fluid.
            With a task open the panel takes 340px and the centre lands near the
            Figma's 816px on its own. With nothing open there was nothing
            holding it, so at 1440 the rows stretched past 1500px and a row's
            record ID sat a screen away from its own title. A task list is read
            by scanning one short column, and past roughly 900px that scan turns
            into a horizontal saccade for every row. */}
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          <div className="mx-auto w-full max-w-[900px]">
          <QuickAdd members={members} links={links} tz={tz} todayKey={todayKey} />

          <div className="mt-4 overflow-hidden rounded-shell border border-rule bg-sheet">
            {groups.length === 0 ? (
              <p className="px-4 py-4 text-[13px] text-ink-2">
                {ranks.size > 0 || claudeOnly
                  ? "Nothing here matches the filter."
                  : (TASK_VIEWS.find((v) => v.key === view)?.blurb ??
                    "Nothing open.")}
              </p>
            ) : null}

            {groups.map((group) => (
              <section key={group.label}>
                <div className="flex items-center gap-2 border-b border-rule bg-paper px-3.5 py-1.5">
                  <span
                    className={`legend ${
                      group.label === "Overdue" ? "text-red" : "text-ink-3"
                    }`}
                  >
                    {group.label}
                  </span>
                  <span className="meta text-ink-3">
                    {group.tasks.filter((t) => !doneOf(t)).length}
                  </span>
                </div>
                <div className="divide-y divide-rule">
                  {group.tasks.map((task) => (
                    <TaskListRow
                      key={task.id}
                      task={task}
                      state={{
                        done: doneOf(task),
                        graced: graced.has(task.id),
                        collapsing: collapsing.has(task.id),
                        error: rowError[task.id] || null,
                      }}
                      ownerNames={ownersOf(task).map(tileNameOf)}
                      noteCount={noteCounts[task.id] ?? 0}
                      link={linkOf(task)}
                      selected={task.id === selectedId}
                      showCompletionTime={false}
                      completedBy="you"
                      tz={tz}
                      dueLabel={dueLabelFor(task, bucketOf(task), tz)}
                      overdue={bucketOf(task) === "overdue"}
                      onToggle={(next) => toggle(task, next)}
                      onUndo={() => undo(task)}
                      onOpen={() => go({ task: task.id })}
                    />
                  ))}
                </div>
              </section>
            ))}

            {/* The toggle sits at the bottom of the list and never above open
                work. Collapsed by default: finished work is not the question
                this screen exists to answer. */}
            {completedTasks.length > 0 ? (
              <div className="border-t border-rule px-3.5 py-2">
                <button
                  type="button"
                  onClick={() => setShowCompleted((v) => !v)}
                  className="legend flex h-7 items-center gap-2 text-ink-3 hover:text-ink"
                >
                  {showCompleted
                    ? "Hide completed"
                    : `Show ${completedTasks.length} completed`}
                  {showCompleted ? (
                    <span className="meta">
                      {completedTasks.length} in the last 30 days
                    </span>
                  ) : null}
                </button>
              </div>
            ) : null}

            {showCompleted && completedTasks.length > 0 ? (
              <>
                {completedGroups.map((group) => (
                  <section key={group.label}>
                    <div className="flex items-center gap-2 border-y border-rule bg-paper px-3.5 py-1.5">
                      <span className="legend text-ink-3">{group.label}</span>
                      <span className="meta text-ink-3">{group.tasks.length}</span>
                    </div>
                    <div className="divide-y divide-rule">
                      {group.tasks.map((task) => (
                        <TaskListRow
                          key={task.id}
                          task={task}
                          state={{
                            done: true,
                            graced: false,
                            collapsing: false,
                            error: rowError[task.id] || null,
                          }}
                          ownerNames={ownersOf(task).map(tileNameOf)}
                          noteCount={noteCounts[task.id] ?? 0}
                          link={linkOf(task)}
                          selected={task.id === selectedId}
                          showCompletionTime
                          completedBy={task.done_by ? nameOf(task.done_by) : null}
                          tz={tz}
                          dueLabel={null}
                          overdue={false}
                          // Reopening returns it to its original due date. We
                          // never touched `due`, so if that date has gone the
                          // row lands in Overdue on the next render.
                          onToggle={(next) => toggle(task, next)}
                          onUndo={() => undo(task)}
                          onOpen={() => go({ task: task.id })}
                        />
                      ))}
                    </div>
                  </section>
                ))}

                {completedTasks.length > completedShown ? (
                  <button
                    type="button"
                    onClick={() => setCompletedShown((n) => n + COMPLETED_PAGE)}
                    className="legend w-full border-t border-rule px-3.5 py-2 text-left text-ink-3 hover:bg-well hover:text-ink"
                  >
                    Load {Math.min(COMPLETED_PAGE, completedTasks.length - completedShown)} more
                  </button>
                ) : null}
              </>
            ) : null}
          </div>

          <p className="meta mt-3 text-ink-3">
            e completes the focused row. Cmd+Z undoes within four seconds.
          </p>
          </div>
        </div>
      </main>

      {selected ? (
        <TaskPanel
          task={selected}
          owners={ownersOf(selected)}
          watchers={watchersByTask[selected.id] ?? []}
          members={members}
          meId={meId}
          isAdmin={isAdmin}
          link={linkOf(selected)}
          activity={activity}
          tz={tz}
          todayKey={todayKey}
          onClose={() => {
            const search = new URLSearchParams();
            if (person) search.set("person", person);
            else search.set("view", view);
            router.push(`/ops/tasks?${search.toString()}`);
          }}
        />
      ) : null}
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * Grouping
 * ------------------------------------------------------------------------- */

function dateGroup(
  task: TaskRow,
  bucket: DueBucket,
  tz: string,
): { key: string; label: string; sort: string } {
  switch (bucket) {
    case "overdue":
      return { key: "overdue", label: "Overdue", sort: "0" };
    case "today":
      return { key: "today", label: "Today", sort: "1" };
    case "tomorrow":
      return { key: "tomorrow", label: "Tomorrow", sort: "2" };
    case "later": {
      const key = dayKey(task.due!, tz);
      return { key, label: dayLabel(task.due!, tz), sort: `3${key}` };
    }
    case "none":
      return { key: "none", label: "No date", sort: "9" };
  }
}

function priorityGroup(task: TaskRow): {
  key: string;
  label: string;
  sort: string;
} {
  const rank = PRIORITY_RANK[task.priority];
  return {
    key: `p${rank}`,
    label: priorityLabel(task.priority),
    sort: String(rank),
  };
}

/** What the row prints on its meta line: a time today, a date otherwise. */
function dueLabelFor(task: TaskRow, bucket: DueBucket, tz: string): string | null {
  if (!task.due) return null;
  if (bucket === "today" || bucket === "tomorrow") {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: tz,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date(task.due));
  }
  return dayLabel(task.due, tz);
}

/** "YYYY-MM-DD" plus n days. Parsed as UTC, so no zone can shift it. */
function addDay(key: string, delta = 1): string {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + delta)).toISOString().slice(0, 10);
}
