// Task lifecycle and priority, defined once. A plain module rather than a
// "use server" file, because server actions and client components both import
// these lists and a "use server" file may only export async functions.
import type { Tone } from "@/components/ui/misc";
import type { TaskPriority, TaskRow, TaskStatus } from "@/lib/supabase/types";
import { dayKey } from "@/lib/time";

export const TASK_STATUSES: { key: TaskStatus; label: string; tone: Tone }[] = [
  { key: "todo", label: "To do", tone: "off" },
  { key: "in_progress", label: "In progress", tone: "on" },
  { key: "pending", label: "Pending", tone: "attention" },
  { key: "blocked", label: "Blocked", tone: "attention" },
  { key: "completed", label: "Completed", tone: "on" },
];

export const TASK_PRIORITIES: { key: TaskPriority; label: string }[] = [
  { key: "low", label: "Low" },
  { key: "normal", label: "Normal" },
  { key: "high", label: "High" },
  { key: "urgent", label: "Urgent" },
];

export const STATUS_BY_KEY = Object.fromEntries(
  TASK_STATUSES.map((s) => [s.key, s]),
) as Record<TaskStatus, (typeof TASK_STATUSES)[number]>;

export const PRIORITY_BY_KEY = Object.fromEntries(
  TASK_PRIORITIES.map((p) => [p.key, p]),
) as Record<TaskPriority, (typeof TASK_PRIORITIES)[number]>;

/* ---------------------------------------------------------------------------
 * Priority as a rank
 *
 * The enum is the database's vocabulary and it stays. The screen's vocabulary
 * is p1 to p4, because that is what a recruiter types into the quick add and
 * what the redesign prints on the row. One mapping, here, so the two can never
 * drift.
 * ------------------------------------------------------------------------- */

export const PRIORITY_RANK: Record<TaskPriority, 1 | 2 | 3 | 4> = {
  urgent: 1,
  high: 2,
  normal: 3,
  low: 4,
};

export const RANK_TO_PRIORITY: Record<number, TaskPriority> = {
  1: "urgent",
  2: "high",
  3: "normal",
  4: "low",
};

export function priorityLabel(priority: TaskPriority): string {
  return `Priority ${PRIORITY_RANK[priority]}`;
}

/**
 * The ring around a task's checkbox.
 *
 * DESIGN.md section 3 allows a hue to carry a category as an accent, never as
 * a fill, and never as the only thing saying what the state is. This is that
 * exception: the ring is a 2px border on a control the user presses, and the
 * words "Priority 1" sit on the row's meta line and in the detail panel, so
 * nothing here is encoded by colour alone.
 */
export const PRIORITY_RING: Record<TaskPriority, string> = {
  urgent: "border-red",
  high: "border-amber",
  normal: "border-ink",
  low: "border-ink-3",
};

/**
 * How urgent a due date is, against a caller-supplied clock so the server
 * render and the client render agree. "Soon" is within 48 hours.
 */
export function dueUrgency(
  due: string | null,
  now: Date,
): "overdue" | "soon" | "none" {
  if (!due) return "none";
  const at = new Date(due).getTime();
  if (at < now.getTime()) return "overdue";
  if (at - now.getTime() < 48 * 3_600_000) return "soon";
  return "none";
}

/* ---------------------------------------------------------------------------
 * Views
 *
 * The redesign's left rail. Every view is derived from rows the workspace
 * already holds, which is why "Overdue on clients" and "Created by Claude" are
 * not a saved-views table: they are two predicates with names on them, and a
 * table would only let somebody save a third one that nothing reads.
 * ------------------------------------------------------------------------- */

export type TaskViewKey =
  | "today"
  | "upcoming"
  | "unassigned"
  | "everything"
  | "overdue-on-clients"
  | "created-by-claude";

export const TASK_VIEWS: {
  key: TaskViewKey;
  label: string;
  group: "views" | "saved";
  blurb: string;
}[] = [
  {
    key: "today",
    label: "Today",
    group: "views",
    blurb: "Everything already due, plus what lands today and tomorrow.",
  },
  {
    key: "upcoming",
    label: "Upcoming",
    group: "views",
    blurb: "Dated work past tomorrow, oldest date first.",
  },
  {
    key: "unassigned",
    label: "Unassigned",
    group: "views",
    blurb: "Open work nobody is carrying.",
  },
  {
    key: "everything",
    label: "Everything",
    group: "views",
    blurb: "Every open task in the workspace.",
  },
  {
    key: "overdue-on-clients",
    label: "Overdue on clients",
    group: "saved",
    blurb: "Past its date and attached to a company.",
  },
  {
    key: "created-by-claude",
    label: "Created by Claude",
    group: "saved",
    blurb: "Open work the ops manager filed for you.",
  },
];

export function isTaskView(value: string | undefined): value is TaskViewKey {
  return TASK_VIEWS.some((v) => v.key === value);
}

/** Which dated band a task falls in, read inside the org's timezone. */
export type DueBucket = "overdue" | "today" | "tomorrow" | "later" | "none";

export function dueBucket(
  due: string | null,
  todayKey: string,
  tomorrowKey: string,
  tz: string,
): DueBucket {
  if (!due) return "none";
  const key = dayKey(due, tz);
  if (key < todayKey) return "overdue";
  if (key === todayKey) return "today";
  if (key === tomorrowKey) return "tomorrow";
  return "later";
}

/**
 * Whether a task belongs in a view.
 *
 * `personId` is the "By person" case, which is a view over the same list
 * rather than a seventh entry in TASK_VIEWS: the rail builds one row per
 * teammate and they all share this predicate.
 */
export function matchesView(
  task: TaskRow,
  view: TaskViewKey,
  bucket: DueBucket,
  owners: string[],
): boolean {
  switch (view) {
    case "today":
      return bucket === "overdue" || bucket === "today" || bucket === "tomorrow";
    case "upcoming":
      return bucket === "later";
    case "unassigned":
      return owners.length === 0;
    case "everything":
      return true;
    case "overdue-on-clients":
      return bucket === "overdue" && task.company_id !== null;
    case "created-by-claude":
      return task.origin === "claude";
  }
}
