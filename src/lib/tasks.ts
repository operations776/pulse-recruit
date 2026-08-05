// Task lifecycle and priority, defined once. A plain module rather than a
// "use server" file, because server actions and client components both import
// these lists and a "use server" file may only export async functions.
import type { Tone } from "@/components/ui/misc";
import type { TaskPriority, TaskStatus } from "@/lib/supabase/types";

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
