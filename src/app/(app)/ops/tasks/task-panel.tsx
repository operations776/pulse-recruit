"use client";

import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useTransition, type ReactNode } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Input, Select } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import {
  setTaskAssignees,
  setTaskDue,
  setTaskPriority,
  setTaskWatching,
} from "@/lib/actions";
import type { TaskLink } from "@/lib/data";
import type {
  OrgMember,
  TaskCommentRow,
  TaskPriority,
  TaskRow,
} from "@/lib/supabase/types";
import { PRIORITY_RANK, RANK_TO_PRIORITY, priorityLabel } from "@/lib/tasks";
import { dayKey, instantAt, timeOfDay } from "@/lib/time";
import { ActivityStream } from "./activity-stream";

/**
 * The open task.
 *
 * A page region, not a drawer. It has no scrim and takes no focus trap,
 * because you read it while working the list beside it, and a modal layer over
 * a list you are still using is the wrong shape. Escape closes it, which is
 * what the ESC legend in the corner is telling you.
 *
 * Which task is open lives in the URL, so the server can fetch this one task's
 * activity instead of every row's.
 */
export function TaskPanel({
  task,
  owners,
  watchers,
  members,
  meId,
  isAdmin,
  link,
  activity,
  tz,
  todayKey,
  onClose,
}: {
  task: TaskRow;
  owners: string[];
  watchers: string[];
  members: OrgMember[];
  meId: string;
  isAdmin: boolean;
  link: TaskLink | null;
  activity: TaskCommentRow[];
  tz: string;
  todayKey: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const { notify } = useToast();
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      const target = event.target as HTMLElement | null;
      // Escape inside the comment box cancels the edit there first.
      if (target && (target.tagName === "TEXTAREA" || target.tagName === "INPUT")) {
        return;
      }
      onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const nameOf = (userId: string) =>
    userId === meId
      ? "You"
      : (members.find((m) => m.user_id === userId)?.display_name ?? "Teammate");

  const run = (label: string, work: () => Promise<{ ok: boolean; error?: string }>) =>
    startTransition(async () => {
      const result = await work();
      if (!result.ok) {
        notify(`${result.error} ${label} was not changed.`, "danger");
        return;
      }
      router.refresh();
    });

  const watching = watchers.includes(meId);
  const dueDay = task.due ? dayKey(task.due, tz) : "";
  const dueTime = task.due ? timeOfDay(task.due, tz) : "17:00";

  const field = (label: string, children: ReactNode) => (
    <div className="flex items-center gap-3 border-b border-rule px-4 py-2.5">
      <span className="legend w-20 shrink-0 text-ink-3">{label}</span>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
        {children}
      </div>
    </div>
  );

  return (
    <aside
      aria-label={`Task ${task.ref}`}
      className="flex w-[340px] shrink-0 flex-col overflow-hidden border-l border-rule bg-sheet"
    >
      <div className="flex items-center justify-between border-b border-rule px-4 py-2.5">
        <span className="legend text-ink-3">Task</span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close task"
          className="legend flex h-7 items-center gap-1.5 rounded-control px-2 text-ink-3 hover:bg-well hover:text-ink"
        >
          Esc
          <X size={13} strokeWidth={2} />
        </button>
      </div>

      <div className="border-b border-rule px-4 py-3">
        <h2 className="text-[17px] font-medium leading-[1.4] text-ink">
          {task.title}
        </h2>
        {task.detail ? (
          <p className="mt-1.5 text-[13px] leading-[1.5] text-ink-2">
            {task.detail}
          </p>
        ) : null}
      </div>

      {field(
        "Due",
        <>
          <Input
            type="date"
            aria-label="Due date"
            value={dueDay}
            disabled={pending}
            onChange={(e) =>
              run("The due date", () =>
                setTaskDue(
                  task.id,
                  e.target.value
                    ? // Keep the time of day that was already on it: changing
                      // the date should not silently move a 09:00 call to 17:00.
                      instantAt(e.target.value, dueTime, tz)
                    : null,
                ),
              )
            }
            className="h-7 w-36 text-[12px]"
          />
          <span className="meta text-ink-3">
            {task.due
              ? dueDay === todayKey
                ? `Today, ${dueTime}`
                : dueTime
              : "No date"}
          </span>
        </>,
      )}

      {field(
        "Assignee",
        <>
          {owners.length === 0 ? (
            <span className="text-[12px] text-ink-3">Nobody</span>
          ) : (
            owners.map((id) => (
              <span
                key={id}
                className="flex items-center gap-1.5 text-[13px] text-ink"
              >
                <Avatar name={nameOf(id)} size="sm" />
                {nameOf(id)}
              </span>
            ))
          )}
          {/* One control, both directions: picking somebody already on the
              task takes them off. Nothing hidden behind a menu. */}
          <Select
            aria-label="Add or remove an assignee"
            value=""
            disabled={pending}
            onChange={(e) => {
              const id = e.target.value;
              if (!id) return;
              run("The assignees", () =>
                setTaskAssignees(
                  task.id,
                  owners.includes(id)
                    ? owners.filter((o) => o !== id)
                    : [...owners, id],
                ),
              );
            }}
            className="h-7 w-28 text-[12px]"
          >
            <option value="">Change</option>
            {members.map((m) => (
              <option key={m.user_id} value={m.user_id}>
                {owners.includes(m.user_id) ? "Remove " : "Add "}
                {m.user_id === meId ? "you" : m.display_name}
              </option>
            ))}
          </Select>
        </>,
      )}

      {field(
        "Watching",
        <>
          {watchers.length === 0 ? (
            <span className="text-[12px] text-ink-3">Nobody</span>
          ) : (
            watchers.map((id) => (
              <span key={id} title={nameOf(id)}>
                <Avatar name={nameOf(id)} size="sm" />
              </span>
            ))
          )}
          {/* PLS-90: one control that alternates, rather than two that each
              only work half the time. */}
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              run("Watching", () => setTaskWatching(task.id, !watching))
            }
            className="legend flex h-7 items-center rounded-chip border border-rule px-2 text-ink-3 hover:bg-well hover:text-ink disabled:opacity-40"
          >
            {watching ? "Stop watching" : "Watch"}
          </button>
        </>,
      )}

      {field(
        "Priority",
        <Select
          aria-label="Priority"
          value={String(PRIORITY_RANK[task.priority])}
          disabled={pending}
          onChange={(e) =>
            run("The priority", () =>
              setTaskPriority(
                task.id,
                RANK_TO_PRIORITY[Number(e.target.value)] as TaskPriority,
              ),
            )
          }
          className="h-7 w-32 text-[12px]"
        >
          {[1, 2, 3, 4].map((rank) => (
            <option key={rank} value={rank}>
              {priorityLabel(RANK_TO_PRIORITY[rank])}
            </option>
          ))}
        </Select>,
      )}

      {link
        ? field(
            "Linked to",
            <span className="legend inline-flex items-center gap-1.5 rounded-chip border border-rule bg-well px-2 py-1 text-ink-2">
              <span className="text-ink-3">{link.label}</span>
              <span className="normal-case tracking-normal text-ink">
                {link.name}
              </span>
            </span>,
          )
        : null}

      <ActivityStream
        taskId={task.id}
        comments={activity}
        members={members}
        meId={meId}
        isAdmin={isAdmin}
        tz={tz}
      />
    </aside>
  );
}
