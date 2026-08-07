"use client";

import { Check } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import type { TaskLink } from "@/lib/data";
import type { TaskRow as Task } from "@/lib/supabase/types";
import { PRIORITY_RANK, PRIORITY_RING, priorityLabel } from "@/lib/tasks";
import { timeOfDay } from "@/lib/time";

export type RowState = {
  /** Completed, including optimistically. */
  done: boolean;
  /** Inside the 4s window: struck through, still in place, Undo in the row. */
  graced: boolean;
  /** The 200ms height collapse that hands the row to the completed group. */
  collapsing: boolean;
  /** A write that came back refused. Quiet, inline, never a modal. */
  error: string | null;
};

/**
 * One row.
 *
 * The completion choreography is the specified part, and it runs in this
 * order: the fill and the tick draw in, the title strikes through and drops to
 * faint, the group count decrements immediately, and Undo lives in the row for
 * four seconds. No toast, because a toast appears in the corner and this
 * happened under the pointer.
 *
 * The write is optimistic and unconditional. If it comes back refused the row
 * returns with a line of text under it, which is the one thing a modal would
 * be worse at: the row is what the user was looking at.
 */
export function TaskListRow({
  task,
  state,
  ownerNames,
  noteCount,
  link,
  selected,
  showCompletionTime,
  completedBy,
  tz,
  dueLabel,
  overdue,
  onToggle,
  onUndo,
  onOpen,
}: {
  task: Task;
  state: RowState;
  ownerNames: string[];
  noteCount: number;
  link: TaskLink | null;
  selected: boolean;
  /** The completed group prints the time it was finished, not the date it was due. */
  showCompletionTime: boolean;
  completedBy: string | null;
  tz: string;
  dueLabel: string | null;
  overdue: boolean;
  onToggle: (done: boolean) => void;
  onUndo: () => void;
  onOpen: () => void;
}) {
  const { done, graced, collapsing, error } = state;

  return (
    <div
      // grid-rows 1fr to 0fr is the collapse. A max-height would need a magic
      // number that is wrong the moment a title wraps to two lines.
      className="grid"
      style={{
        gridTemplateRows: collapsing ? "0fr" : "1fr",
        opacity: collapsing ? 0 : 1,
        // DESIGN.md rule 11 caps motion at 220ms. The global reduced-motion
        // rule collapses both of these to nothing, which is exactly the
        // "skip the collapse" the spec asks for.
        transition: "grid-template-rows 200ms ease-out, opacity 120ms ease-out",
      }}
    >
      <div className="overflow-hidden">
        <div
          onKeyDown={(event) => {
            // e completes the focused row. Ignored while typing, and ignored
            // on a row that is already finished.
            if (event.key !== "e" || event.metaKey || event.ctrlKey) return;
            const target = event.target as HTMLElement;
            if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
            event.preventDefault();
            onToggle(!done);
          }}
          className={`settle flex items-start gap-3 border-l-2 px-3.5 py-2.5 ${
            selected
              ? "border-l-violet bg-well"
              : "border-l-transparent hover:bg-well"
          }`}
        >
          <button
            type="button"
            role="checkbox"
            aria-checked={done}
            aria-label={
              done ? `Reopen ${task.title}` : `Complete ${task.title}`
            }
            title={done ? "Reopen" : `Complete. ${priorityLabel(task.priority)}`}
            onClick={() => onToggle(!done)}
            // DESIGN.md rule 10: no hit target below 28px. The ring the Figma
            // draws is 16px, so the target is a 28px box around it rather than
            // a 16px one somebody has to aim at.
            className="group -my-1 flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-control"
          >
            <span
              // A circle, per every frame in the spec sheet. Rev E restored
              // circles for exactly this control.
              className={`settle flex size-4 items-center justify-center rounded-full border-2 group-hover:border-[3px] ${
                done
                  ? graced
                    ? "border-violet bg-violet text-on-violet"
                    : // Neutral grey once it is really done. Priority is a
                      // planning signal and it stops being true here.
                      "border-ink-3 bg-ink-3 text-sheet"
                  : `bg-transparent ${PRIORITY_RING[task.priority]}`
              }`}
            >
              {done ? <Check size={10} strokeWidth={3} /> : null}
            </span>
          </button>

          <button
            type="button"
            onClick={onOpen}
            className="min-w-0 flex-1 cursor-pointer text-left"
          >
            <span
              className={`block truncate text-[14px] leading-[1.5] ${
                done ? "text-ink-3 line-through" : "text-ink"
              }`}
            >
              {task.title}
            </span>

            <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
              {graced ? (
                <span className="legend text-ink-3">
                  Completed by {completedBy ?? "you"}
                </span>
              ) : showCompletionTime ? (
                <span className="legend text-ink-3">
                  Completed {task.done_at ? timeOfDay(task.done_at, tz) : ""}
                  {completedBy ? ` by ${completedBy}` : ""}
                </span>
              ) : (
                <>
                  {dueLabel ? (
                    <span
                      className={`legend ${overdue ? "text-red" : "text-ink-3"}`}
                    >
                      {dueLabel}
                    </span>
                  ) : null}
                  {/* Rule 9: the priority hue on the checkbox never stands
                      alone. Above normal, the row says which one in words. */}
                  {PRIORITY_RANK[task.priority] <= 2 ? (
                    <span className="legend text-ink-3">
                      {priorityLabel(task.priority)}
                    </span>
                  ) : null}
                </>
              )}

              {link && !graced ? (
                <span className="legend inline-flex items-center gap-1.5 rounded-chip border border-rule bg-well px-1.5 py-0.5 text-ink-2">
                  <span className="text-ink-3">{link.label}</span>
                  <span className="normal-case tracking-normal">{link.name}</span>
                </span>
              ) : null}

              {task.origin === "claude" && !graced ? (
                <span className="legend rounded-chip border border-rule bg-well px-1.5 py-0.5 text-ink-2">
                  Claude
                </span>
              ) : null}

              {noteCount > 0 && !graced ? (
                <span className="legend text-ink-3">
                  {noteCount} {noteCount === 1 ? "note" : "notes"}
                </span>
              ) : null}
            </span>

            {error ? (
              <span className="mt-1 block text-[12px] leading-[1.4] text-red">
                {error}
              </span>
            ) : null}
          </button>

          {graced ? (
            <button
              type="button"
              onClick={onUndo}
              // h-7, because DESIGN.md rule 10 puts the floor at 28px and this
              // is the one control in the row that is only there for 4 seconds.
              className="cap flex h-7 shrink-0 items-center rounded-control border border-ink bg-sheet px-2.5 text-[12px] font-medium text-ink [--edge:var(--color-ink)] hover:bg-well"
            >
              Undo
            </button>
          ) : (
            <span className="mt-0.5 flex shrink-0 items-center gap-1">
              {/* Neutral tiles, per src/lib/hue.ts: colour roles are fully
                  spoken for, so identity runs through the record ID instead. */}
              {ownerNames.map((name) => (
                <span key={name} title={name} className={done ? "opacity-50" : ""}>
                  <Avatar name={name} size="sm" />
                </span>
              ))}
              <span className="record-id ml-1 text-ink-3">{task.ref}</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
