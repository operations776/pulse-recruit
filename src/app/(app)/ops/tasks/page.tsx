"use client";

import { Check, Plus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";
import { StatusChip } from "@/components/ui/misc";
import { Dialog } from "@/components/ui/overlay";
import { useToast } from "@/components/ui/toast";
import { useStore } from "@/lib/store";
import type { Task } from "@/lib/types";

// Pillar 2. The list the ops manager fills. A task it wrote carries the Claude
// chip, so the recruiter always knows which lines are his own.
export default function TasksPage() {
  const { state, addTask, toggleTask } = useStore();
  const { notify } = useToast();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const [error, setError] = useState("");

  const todo = state.tasks.filter((t) => !t.done);
  const done = state.tasks.filter((t) => t.done);

  const reset = () => {
    setTitle("");
    setDetail("");
    setError("");
  };

  const close = () => {
    reset();
    setOpen(false);
  };

  const submit = () => {
    const trimmed = title.trim();
    if (!trimmed) {
      setError("Give the task a title.");
      return;
    }
    addTask(trimmed, detail.trim());
    notify(`Task added: ${trimmed}`);
    close();
  };

  const nameFor = (candidateId?: string) =>
    candidateId
      ? state.candidates.find((c) => c.id === candidateId)?.name
      : undefined;

  const row = (task: Task) => {
    const linked = nameFor(task.linkedCandidateId);
    return (
      <div
        key={task.id}
        className="flex items-start gap-3 border-b border-rule px-4 py-3"
      >
        <button
          type="button"
          role="checkbox"
          aria-checked={task.done}
          aria-label={task.done ? `Reopen ${task.title}` : `Complete ${task.title}`}
          onClick={() => toggleTask(task.id)}
          className={`mt-px flex size-7 shrink-0 items-center justify-center rounded-control border ${
            task.done
              ? "border-teal bg-teal text-sheet"
              : "border-ink bg-transparent text-ink hover:bg-well"
          }`}
        >
          {task.done ? <Check size={15} strokeWidth={2.5} /> : null}
        </button>

        <div className="min-w-0 flex-1">
          <p
            className={`text-[13px] font-medium leading-[1.5] ${
              task.done ? "text-ink-3 line-through" : ""
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
            {todo.length} open of {state.tasks.length}
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
            <Button variant="primary" onClick={submit}>
              Add task
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3.5">
          <Field label="Title">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
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
