"use client";

import { ArrowDown, ArrowUp, Check, Plus, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { StatusChip } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import {
  createTask,
  setTaskAssignees,
  setTaskPriority,
  setTaskStatus,
  toggleTask,
} from "@/lib/actions";
import type {
  OrgMember,
  TaskPriority,
  TaskRow,
  TaskStatus,
} from "@/lib/supabase/types";
import { dueUrgency, TASK_PRIORITIES, TASK_STATUSES } from "@/lib/tasks";
import { formatDate } from "@/lib/time";

type View = "mine" | "everyone";
type SortKey = "due" | "priority" | "title" | "status";

const SORT_STORAGE = "pulse-tasks-sort";

const PRIORITY_ORDER: Record<TaskPriority, number> = {
  urgent: 0,
  high: 1,
  normal: 2,
  low: 3,
};

const STATUS_ORDER: Record<TaskStatus, number> = {
  blocked: 0,
  in_progress: 1,
  pending: 2,
  todo: 3,
  completed: 4,
};

export function TaskList({
  tasks,
  assigneesByTask,
  members,
  meId,
  linkedNames,
  now,
}: {
  tasks: TaskRow[];
  assigneesByTask: Record<string, string[]>;
  members: OrgMember[];
  meId: string;
  linkedNames: Record<string, string>;
  now: string;
}) {
  const router = useRouter();
  const { notify } = useToast();
  const [pending, startTransition] = useTransition();
  const clock = useMemo(() => new Date(now), [now]);

  const memberName = useMemo(() => {
    const map: Record<string, string> = {};
    for (const m of members) map[m.user_id] = m.display_name;
    return map;
  }, [members]);

  const [view, setView] = useState<View>("mine");
  const [sortKey, setSortKey] = useState<SortKey>("due");
  const [sortAsc, setSortAsc] = useState(true);

  // The sort survives a reload: reading it back is a one-shot effect because
  // localStorage does not exist during the server render.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(SORT_STORAGE);
      if (!raw) return;
      const saved = JSON.parse(raw) as { key: SortKey; asc: boolean };
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot restore
      setSortKey(saved.key);
      setSortAsc(saved.asc);
    } catch {
      // a corrupt value just means the default sort
    }
  }, []);

  const sortBy = (key: SortKey) => {
    const asc = key === sortKey ? !sortAsc : true;
    setSortKey(key);
    setSortAsc(asc);
    localStorage.setItem(SORT_STORAGE, JSON.stringify({ key, asc }));
  };

  // Optimistic overlays: the dropdowns patch a single field and the row is
  // already right on screen, so the server round trip never blocks the UI.
  const [statusOverride, setStatusOverride] = useState<
    Record<string, TaskStatus>
  >({});
  const [priorityOverride, setPriorityOverride] = useState<
    Record<string, TaskPriority>
  >({});

  const statusOf = (t: TaskRow) => statusOverride[t.id] ?? t.status;
  const priorityOf = (t: TaskRow) => priorityOverride[t.id] ?? t.priority;
  const assigneesOf = (t: TaskRow) => assigneesByTask[t.id] ?? [];

  const changeStatus = (task: TaskRow, status: TaskStatus) => {
    const before = statusOf(task);
    setStatusOverride((s) => ({ ...s, [task.id]: status }));
    startTransition(async () => {
      const result = await setTaskStatus(task.id, status);
      if (!result.ok) {
        setStatusOverride((s) => ({ ...s, [task.id]: before }));
        notify(`${result.error} ${task.ref} was not moved.`, "danger");
        return;
      }
      router.refresh();
    });
  };

  const changePriority = (task: TaskRow, priority: TaskPriority) => {
    const before = priorityOf(task);
    setPriorityOverride((s) => ({ ...s, [task.id]: priority }));
    startTransition(async () => {
      const result = await setTaskPriority(task.id, priority);
      if (!result.ok) {
        setPriorityOverride((s) => ({ ...s, [task.id]: before }));
        notify(`${result.error} ${task.ref} was not changed.`, "danger");
      }
    });
  };

  const toggle = (task: TaskRow) => {
    const next = statusOf(task) !== "completed";
    changeStatusViaToggle(task, next);
  };

  const changeStatusViaToggle = (task: TaskRow, done: boolean) => {
    const before = statusOf(task);
    setStatusOverride((s) => ({ ...s, [task.id]: done ? "completed" : "todo" }));
    startTransition(async () => {
      const result = await toggleTask(task.id, done);
      if (!result.ok) {
        setStatusOverride((s) => ({ ...s, [task.id]: before }));
        notify(`${result.error} ${task.ref} was not changed.`, "danger");
        return;
      }
      router.refresh();
    });
  };

  const assign = (task: TaskRow, userIds: string[]) => {
    startTransition(async () => {
      const result = await setTaskAssignees(task.id, userIds);
      if (!result.ok) {
        notify(`${result.error} Assignees were not changed.`, "danger");
        return;
      }
      router.refresh();
    });
  };

  const visible = useMemo(() => {
    const mine =
      view === "mine"
        ? tasks.filter((t) => assigneesOf(t).includes(meId))
        : tasks;

    const compare = (a: TaskRow, b: TaskRow): number => {
      let result = 0;
      if (sortKey === "due") {
        const ad = a.due ? new Date(a.due).getTime() : Infinity;
        const bd = b.due ? new Date(b.due).getTime() : Infinity;
        result = ad - bd;
      } else if (sortKey === "priority") {
        result = PRIORITY_ORDER[priorityOf(a)] - PRIORITY_ORDER[priorityOf(b)];
      } else if (sortKey === "status") {
        result = STATUS_ORDER[statusOf(a)] - STATUS_ORDER[statusOf(b)];
      } else {
        result = a.title.localeCompare(b.title);
      }
      return sortAsc ? result : -result;
    };

    return [...mine].sort(compare);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- assigneesOf/statusOf are stable wrappers over the deps listed
  }, [tasks, view, meId, sortKey, sortAsc, statusOverride, priorityOverride, assigneesByTask]);

  const open = visible.filter((t) => statusOf(t) !== "completed");
  const done = visible.filter((t) => statusOf(t) === "completed");

  // The team view groups the open list per person, because "who is carrying
  // what" is the question that view exists to answer. A task with three
  // assignees appears under all three: that is the truth, not a duplicate.
  const groups = useMemo(() => {
    if (view !== "everyone") return null;
    const byPerson = new Map<string, TaskRow[]>();
    const unassigned: TaskRow[] = [];
    for (const task of open) {
      const owners = assigneesOf(task);
      if (owners.length === 0) {
        unassigned.push(task);
        continue;
      }
      for (const owner of owners) {
        const list = byPerson.get(owner) ?? [];
        list.push(task);
        byPerson.set(owner, list);
      }
    }
    return { byPerson, unassigned };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- open derives from the deps listed
  }, [view, open, assigneesByTask]);

  const sortHeader = (key: SortKey, label: string) => (
    <button
      onClick={() => sortBy(key)}
      aria-label={`Sort by ${label}`}
      className={`legend flex items-center gap-1 ${
        sortKey === key ? "text-ink" : "text-ink-3 hover:text-ink"
      }`}
    >
      {label}
      {sortKey === key ? (
        sortAsc ? (
          <ArrowUp size={11} strokeWidth={2} />
        ) : (
          <ArrowDown size={11} strokeWidth={2} />
        )
      ) : null}
    </button>
  );

  const row = (task: TaskRow) => {
    const status = statusOf(task);
    const isDone = status === "completed";
    const linked = task.candidate_id ? linkedNames[task.candidate_id] : null;
    const urgency = isDone ? "none" : dueUrgency(task.due, clock);
    const owners = assigneesOf(task);

    return (
      <div
        key={task.id}
        className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-rule px-4 py-2.5"
      >
        <button
          type="button"
          role="checkbox"
          aria-checked={isDone}
          aria-label={isDone ? `Reopen ${task.title}` : `Complete ${task.title}`}
          disabled={pending}
          onClick={() => toggle(task)}
          className={`flex size-7 shrink-0 items-center justify-center rounded-control border disabled:opacity-40 ${
            isDone
              ? "border-violet bg-violet text-on-violet"
              : "border-ink bg-transparent text-ink hover:bg-well"
          }`}
        >
          {isDone ? <Check size={15} strokeWidth={2.5} /> : null}
        </button>

        <div className="min-w-[14rem] flex-1">
          <p
            className={`text-[13px] font-medium leading-[1.5] ${
              isDone ? "text-ink-3 line-through" : ""
            }`}
          >
            {task.title}
          </p>
          {task.detail ? (
            <p className="mt-0.5 truncate text-[12px] leading-[1.5] text-ink-2">
              {task.detail}
            </p>
          ) : null}
          {linked ? (
            <p className="mt-0.5 text-[12px] text-ink-2">Linked to {linked}</p>
          ) : null}
        </div>

        <Select
          aria-label={`Status of ${task.ref}`}
          value={status}
          disabled={pending}
          onChange={(e) => changeStatus(task, e.target.value as TaskStatus)}
          className="h-7 w-32 shrink-0 text-[12px]"
        >
          {TASK_STATUSES.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </Select>

        <Select
          aria-label={`Priority of ${task.ref}`}
          value={priorityOf(task)}
          disabled={pending}
          onChange={(e) => changePriority(task, e.target.value as TaskPriority)}
          className="h-7 w-24 shrink-0 text-[12px]"
        >
          {TASK_PRIORITIES.map((p) => (
            <option key={p.key} value={p.key}>
              {p.label}
            </option>
          ))}
        </Select>

        <AssigneeControl
          task={task}
          owners={owners}
          members={members}
          memberName={memberName}
          meId={meId}
          disabled={pending}
          onChange={assign}
        />

        <span
          className={`meta w-24 shrink-0 text-right ${
            urgency === "overdue"
              ? "font-medium text-red"
              : urgency === "soon"
                ? "font-medium text-amber-text"
                : "text-ink-3"
          }`}
          title={
            urgency === "overdue"
              ? "Overdue"
              : urgency === "soon"
                ? "Due within 48 hours"
                : undefined
          }
        >
          {task.due ? formatDate(task.due) : "no date"}
        </span>

        <span className="flex w-20 shrink-0 items-center justify-end gap-2">
          {task.origin === "claude" ? (
            <StatusChip tone="on">Claude</StatusChip>
          ) : null}
          <span className="record-id text-ink-3">{task.ref}</span>
        </span>
      </div>
    );
  };

  return (
    <main className="flex min-w-0 flex-1 flex-col overflow-hidden bg-paper">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-rule px-6 py-5">
        <div>
          <p className="legend text-ink-3">Pillar 2 / AI operations manager</p>
          <h1 className="display mt-2 text-[18px]">Tasks</h1>
          <p className="meta mt-2 text-ink-2">
            {open.length} open of {visible.length}
            {view === "mine" ? " assigned to you" : ""}
          </p>
        </div>

        {/* DESIGN.md section 9: a toggle group is an inset well holding caps. */}
        <div className="well flex gap-1 rounded-control p-1">
          {(
            [
              ["mine", "Mine"],
              ["everyone", "Everyone"],
            ] as [View, string][]
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setView(key)}
              aria-pressed={view === key}
              className={`legend flex h-7 items-center rounded-control px-3 ${
                view === key
                  ? "cap bg-violet text-on-violet [--edge:var(--color-violet-edge)]"
                  : "text-ink-2 hover:text-ink"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-6">
        <div className="overflow-hidden rounded-shell border border-rule bg-sheet [&>*:last-child]:border-b-0">
          <AddRow members={members} meId={meId} />

          <div className="flex items-center gap-3 border-b border-rule px-4 py-2">
            <span className="w-7 shrink-0" />
            <span className="min-w-[14rem] flex-1">
              {sortHeader("title", "Task")}
            </span>
            <span className="w-32 shrink-0">{sortHeader("status", "Status")}</span>
            <span className="w-24 shrink-0">
              {sortHeader("priority", "Priority")}
            </span>
            <span className="legend w-28 shrink-0 text-ink-3">Assigned</span>
            <span className="w-24 shrink-0 text-right">
              {sortHeader("due", "Due")}
            </span>
            <span className="w-20 shrink-0" />
          </div>

          {view === "everyone" && groups ? (
            <>
              {members.map((member) => {
                const theirs = groups.byPerson.get(member.user_id) ?? [];
                return (
                  <div key={member.user_id}>
                    <div className="flex items-center gap-2 border-b border-rule bg-paper px-4 py-2">
                      <Users size={13} strokeWidth={1.75} className="text-ink-3" />
                      <span className="legend text-ink-2">
                        {member.user_id === meId ? "You" : member.display_name}
                      </span>
                      <span className="meta text-ink-3">{theirs.length}</span>
                    </div>
                    {theirs.length > 0 ? (
                      theirs.map(row)
                    ) : (
                      <p className="border-b border-rule px-4 py-2.5 text-[12px] text-ink-3">
                        Nothing open.
                      </p>
                    )}
                  </div>
                );
              })}
              {groups.unassigned.length > 0 ? (
                <div>
                  <div className="flex items-center gap-2 border-b border-rule bg-paper px-4 py-2">
                    <span className="legend text-ink-2">Unassigned</span>
                    <span className="meta text-ink-3">
                      {groups.unassigned.length}
                    </span>
                  </div>
                  {groups.unassigned.map(row)}
                </div>
              ) : null}
            </>
          ) : (
            <>
              {open.length > 0 ? (
                open.map(row)
              ) : (
                <p className="border-b border-rule px-4 py-3 text-[12px] text-ink-2">
                  {view === "mine"
                    ? "Nothing assigned to you. The Everyone tab shows the whole workspace."
                    : "Nothing open. The ops manager adds a task here when it finds something that needs you."}
                </p>
              )}
            </>
          )}

          <div className="border-b border-rule px-4 py-2.5">
            <p className="legend text-ink-3">Completed</p>
          </div>
          {done.length > 0 ? (
            done.map(row)
          ) : (
            <p className="border-b border-rule px-4 py-3 text-[12px] text-ink-2">
              Nothing finished yet this week.
            </p>
          )}
        </div>
      </div>
    </main>
  );
}

/**
 * The always-mounted quick add. Being always mounted is why the underlying
 * action can keep revalidatePath: the remount-under-a-layer bug only bites
 * inside dialogs and drawers.
 */
function AddRow({ members, meId }: { members: OrgMember[]; meId: string }) {
  const router = useRouter();
  const { notify } = useToast();
  const [pending, startTransition] = useTransition();

  const [title, setTitle] = useState("");
  const [assignee, setAssignee] = useState(meId);
  const [priority, setPriority] = useState<TaskPriority>("normal");
  const [due, setDue] = useState("");

  const submit = () => {
    const trimmed = title.trim();
    if (!trimmed) {
      notify("Give the task a title.", "danger");
      return;
    }
    setTitle("");
    startTransition(async () => {
      const result = await createTask(trimmed, "", {
        due: due ? new Date(`${due}T17:00`).toISOString() : null,
        priority,
        assigneeIds: assignee ? [assignee] : [],
      });
      if (!result.ok) {
        setTitle(trimmed);
        notify(`${result.error} The task was not added.`, "danger");
        return;
      }
      notify(`Task added: ${trimmed}`);
      setDue("");
      router.refresh();
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-rule bg-paper px-4 py-2.5">
      <Input
        value={title}
        aria-label="New task title"
        placeholder="Add a task, assign it, give it a date"
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
        }}
        className="h-8 min-w-[14rem] flex-1"
      />
      <Select
        aria-label="Assign to"
        value={assignee}
        onChange={(e) => setAssignee(e.target.value)}
        className="h-8 w-32 shrink-0 text-[12px]"
      >
        <option value="">Unassigned</option>
        {members.map((m) => (
          <option key={m.user_id} value={m.user_id}>
            {m.user_id === meId ? "You" : m.display_name}
          </option>
        ))}
      </Select>
      <Select
        aria-label="Priority"
        value={priority}
        onChange={(e) => setPriority(e.target.value as TaskPriority)}
        className="h-8 w-24 shrink-0 text-[12px]"
      >
        {TASK_PRIORITIES.map((p) => (
          <option key={p.key} value={p.key}>
            {p.label}
          </option>
        ))}
      </Select>
      <Input
        type="date"
        aria-label="Due date"
        value={due}
        onChange={(e) => setDue(e.target.value)}
        className="h-8 w-36 shrink-0"
      />
      <Button variant="primary" onClick={submit} disabled={pending}>
        <Plus size={13} strokeWidth={2.25} />
        Add
      </Button>
    </div>
  );
}

/**
 * Who owns the task. A compact popover-free editor: the chip lists the names,
 * and the select adds or removes one owner per interaction. Nothing lives
 * behind hover.
 */
function AssigneeControl({
  task,
  owners,
  members,
  memberName,
  meId,
  disabled,
  onChange,
}: {
  task: TaskRow;
  owners: string[];
  members: OrgMember[];
  memberName: Record<string, string>;
  meId: string;
  disabled: boolean;
  onChange: (task: TaskRow, userIds: string[]) => void;
}) {
  const label =
    owners.length === 0
      ? "Unassigned"
      : owners
          .map((id) => (id === meId ? "You" : (memberName[id] ?? "Teammate")))
          .join(", ");

  return (
    <span className="flex w-28 shrink-0 flex-col gap-1">
      <Select
        aria-label={`Assignees of ${task.ref}`}
        value=""
        disabled={disabled}
        onChange={(e) => {
          const id = e.target.value;
          if (!id) return;
          // Already an owner: picking them again removes them. One control,
          // both directions, no hidden menu.
          onChange(
            task,
            owners.includes(id)
              ? owners.filter((o) => o !== id)
              : [...owners, id],
          );
        }}
        className="h-7 w-28 text-[12px]"
      >
        <option value="">{label}</option>
        {members.map((m) => (
          <option key={m.user_id} value={m.user_id}>
            {owners.includes(m.user_id) ? "Remove " : "Add "}
            {m.user_id === meId ? "you" : m.display_name}
          </option>
        ))}
      </Select>
    </span>
  );
}
