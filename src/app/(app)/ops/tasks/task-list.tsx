"use client";

import { Check, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";
import { StatusChip } from "@/components/ui/misc";
import { Dialog } from "@/components/ui/overlay";
import { useToast } from "@/components/ui/toast";
import { createTask, toggleTask } from "@/lib/actions";
import type { TaskRow } from "@/lib/supabase/types";

export function TaskList({
  tasks,
  linkedNames,
}: {
  tasks: TaskRow[];
  linkedNames: Record<string, string>;
}) {
  const router = useRouter();
  const { notify } = useToast();
  const [pending, startTransition] = useTransition();

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const [error, setError] = useState("");

  // Done state is the timestamp, not a boolean column. A task is done when it
  // records when it was finished.
  const todo = tasks.filter((t) => t.done_at === null);
  const done = tasks.filter((t) => t.done_at !== null);

  const close = () => {
    setTitle("");
    setDetail("");
    setError("");
    setOpen(false);
  };

  const submit = () => {
    const trimmed = title.trim();
    if (!trimmed) {
      setError("Give the task a title.");
      return;
    }
    const body = detail.trim();

    // The action revalidates this route, and a revalidate landing under an open
    // dialog remounts the tree beneath it. Close first, then write, and report
    // a failure through the toast so nothing is lost silently.
    close();

    startTransition(async () => {
      const result = await createTask(trimmed, body);
      if (!result.ok) {
        notify(`${result.error} The task was not added.`, "danger");
        return;
      }
      notify(`Task added: ${trimmed}`);
      router.refresh();
    });
  };

  const toggle = (task: TaskRow) => {
    const next = task.done_at === null;
    startTransition(async () => {
      const result = await toggleTask(task.id, next);
      if (!result.ok) {
        notify(`${result.error} ${task.ref} was not changed.`, "danger");
        return;
      }
      router.refresh();
    });
  };

  const row = (task: TaskRow) => {
    const isDone = task.done_at !== null;
    const linked = task.candidate_id ? linkedNames[task.candidate_id] : null;

    return (
      <div
        key={task.id}
        className="flex items-start gap-3 border-b border-rule px-4 py-3"
      >
        <button
          type="button"
          role="checkbox"
          aria-checked={isDone}
          aria-label={isDone ? `Reopen ${task.title}` : `Complete ${task.title}`}
          disabled={pending}
          onClick={() => toggle(task)}
          className={`mt-px flex size-7 shrink-0 items-center justify-center rounded-control border disabled:opacity-40 ${
            isDone
              ? "border-teal bg-teal text-sheet"
              : "border-ink bg-transparent text-ink hover:bg-well"
          }`}
        >
          {isDone ? <Check size={15} strokeWidth={2.5} /> : null}
        </button>

        <div className="min-w-0 flex-1">
          <p
            className={`text-[13px] font-medium leading-[1.5] ${
              isDone ? "text-ink-3 line-through" : ""
            }`}
          >
            {task.title}
          </p>
          {task.detail ? (
            <p className="mt-0.5 text-[12px] leading-[1.5] text-ink-2">
              {task.detail}
            </p>
          ) : null}
          {linked ? (
            <p className="mt-1 text-[12px] text-ink-2">Linked to {linked}</p>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-3">
          {task.origin === "claude" ? (
            <StatusChip tone="on">Claude</StatusChip>
          ) : null}
          <span className="record-id text-ink-3">{task.ref}</span>
        </div>
      </div>
    );
  };

  return (
    <main className="flex min-w-0 flex-1 flex-col overflow-hidden bg-paper">
      <header className="flex items-start justify-between gap-4 border-b border-rule px-6 py-5">
        <div>
          <p className="legend text-ink-3">Pillar 2 / AI operations manager</p>
          <h1 className="display mt-2 text-[18px]">Tasks</h1>
          <p className="meta mt-2 text-ink-2">
            {todo.length} open of {tasks.length}
          </p>
        </div>
        <Button variant="primary" onClick={() => setOpen(true)}>
          <Plus size={13} strokeWidth={2.25} />
          Add task
        </Button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-6">
        {/*
          DESIGN.md section 7: both sections live in one shell and meet on a
          single 1px rule. No gap, because a gap would break the sheet.
        */}
        <div className="overflow-hidden rounded-shell border border-rule bg-sheet [&>*:last-child]:border-b-0">
          <div className="border-b border-rule px-4 py-2.5">
            <p className="legend text-ink-3">To do</p>
          </div>
          {todo.length > 0 ? (
            todo.map(row)
          ) : (
            <p className="border-b border-rule px-4 py-3 text-[12px] text-ink-2">
              Nothing open. The ops manager adds a task here when it finds
              something that needs you.
            </p>
          )}

          <div className="border-b border-rule px-4 py-2.5">
            <p className="legend text-ink-3">Done</p>
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

      <Dialog
        open={open}
        onClose={close}
        title="Add task"
        description="It lands at the top of your to do list straight away."
        footer={
          <>
            <Button onClick={close}>Cancel</Button>
            <Button variant="primary" onClick={submit} disabled={pending}>
              Add task
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3.5">
          <Field label="Title">
            <Input
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (error) setError("");
              }}
              placeholder="Chase the Vantora paperwork"
              autoFocus
            />
          </Field>
          <Field label="Detail">
            <Textarea
              rows={3}
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              placeholder="What has to happen, and why it matters."
            />
          </Field>

          {error ? (
            <p role="alert" className="text-[12px] font-medium text-red">
              {error}
            </p>
          ) : null}
        </div>
      </Dialog>
    </main>
  );
}
