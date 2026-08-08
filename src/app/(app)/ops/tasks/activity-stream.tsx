"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Avatar } from "@/components/ui/avatar";
import { useToast } from "@/components/ui/toast";
import { useRouter } from "next/navigation";
import {
  addTaskComment,
  deleteTaskComment,
  editTaskComment,
} from "@/lib/actions";
import type { OrgMember, TaskCommentRow } from "@/lib/supabase/types";

/**
 * One stream, two kinds of entry.
 *
 * System events are the audit trail: nobody edits them, and an entry Claude
 * wrote stays exactly as written even when it turns out to be wrong, because a
 * record you can rewrite is not a record. A human disagreeing comments
 * underneath.
 *
 * Oldest first. This is a log, not a chat, and it is read top to bottom by
 * somebody picking the task up.
 *
 * The one deliberate departure from the Figma frames: they put Reply, Edit and
 * Delete behind hover. DESIGN.md is explicit that nothing lives behind hover,
 * and names it as the pattern that fails this audience hardest. The actions are
 * always mounted, in mono at --ink-3, which is quiet enough to stay out of the
 * way of the words.
 */
export function ActivityStream({
  taskId,
  comments,
  members,
  meId,
  isAdmin,
  tz,
}: {
  taskId: string;
  comments: TaskCommentRow[];
  members: OrgMember[];
  meId: string;
  isAdmin: boolean;
  tz: string;
}) {
  const router = useRouter();
  const { notify } = useToast();
  const [pending, startTransition] = useTransition();

  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [armed, setArmed] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<TaskCommentRow | null>(null);

  const nameOf = (userId: string | null) => {
    if (!userId) return "Claude";
    if (userId === meId) return "You";
    return members.find((m) => m.user_id === userId)?.display_name ?? "Teammate";
  };

  /**
   * Delete with no modal. The row swaps to Delete and Cancel in place, and
   * commits on its own after three seconds. A confirmation dialog for one line
   * of text is heavier than the thing it is protecting.
   */
  useEffect(() => {
    if (!armed) return;
    const id = armed;
    const timer = setTimeout(() => {
      setArmed(null);
      startTransition(async () => {
        const result = await deleteTaskComment(id);
        if (!result.ok) {
          notify(`${result.error} The comment is still there.`, "danger");
          return;
        }
        router.refresh();
      });
    }, 3000);
    return () => clearTimeout(timer);
  }, [armed, notify, router]);

  const saveEdit = (comment: TaskCommentRow) => {
    const body = draft.trim();
    if (!body) return;
    if (body === comment.body) {
      setEditing(null);
      return;
    }
    setEditing(null);
    startTransition(async () => {
      const result = await editTaskComment(comment.id, body);
      if (!result.ok) {
        notify(`${result.error} The edit was not saved.`, "danger");
        return;
      }
      router.refresh();
    });
  };

  const action = (label: string, onClick: () => void, danger = false) => (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      // h-7: DESIGN.md rule 10 puts the hit-target floor at 28px, and these are
      // small enough visually that only the padding is doing that work.
      className={`legend flex h-7 items-center rounded-chip border px-2 disabled:opacity-40 ${
        danger
          ? "border-rule text-ink-3 hover:border-red hover:bg-red-bg hover:text-red"
          : "border-rule text-ink-3 hover:bg-well hover:text-ink"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between border-b border-rule px-4 py-2.5">
        <p className="display text-[13px]">Activity</p>
        <span className="meta text-ink-3">{comments.length}</span>
      </div>

      <ul className="min-h-0 flex-1 overflow-y-auto">
        {comments.length === 0 ? (
          <li className="px-4 py-3 text-[12px] text-ink-2">
            Nothing yet. The first comment pulls in whoever you mention.
          </li>
        ) : null}

        {comments.map((comment) => {
          const system = comment.kind === "system";
          const mine = comment.author_id === meId;
          const deleted = comment.deleted_at !== null;
          const parent = comment.reply_to
            ? comments.find((c) => c.id === comment.reply_to)
            : null;

          return (
            <li key={comment.id} className="border-b border-rule px-4 py-3">
              <div className="flex items-start gap-2.5">
                <Avatar name={nameOf(comment.author_id)} size="sm" />

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[13px] font-medium text-ink">
                      {nameOf(comment.author_id)}
                    </span>
                    <span className="legend text-ink-3">
                      {stamp(comment.created_at, tz)}
                    </span>
                    {comment.edited_at ? (
                      // Next to the timestamp, per the spec. The original text
                      // is not recoverable by the user: that is what the edit
                      // means, and pretending otherwise needs a version table.
                      <span className="legend text-ink-3">Edited</span>
                    ) : null}
                  </div>

                  {parent ? (
                    <p className="mt-1 truncate border-l-2 border-rule pl-2 text-[12px] text-ink-3">
                      {parent.deleted_at ? "Comment deleted" : parent.body}
                    </p>
                  ) : null}

                  {deleted ? (
                    // A tombstone only where one is needed: this row exists
                    // because somebody replied underneath it, and removing it
                    // would leave the reply answering nothing.
                    <p className="mt-1 text-[13px] italic text-ink-3">
                      Comment deleted
                    </p>
                  ) : editing === comment.id ? (
                    <div className="mt-1.5 rounded-control border border-violet bg-sheet p-2">
                      <textarea
                        autoFocus
                        value={draft}
                        rows={2}
                        aria-label="Edit comment"
                        onChange={(e) => setDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Escape") {
                            e.preventDefault();
                            setEditing(null);
                          }
                          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                            e.preventDefault();
                            saveEdit(comment);
                          }
                        }}
                        className="w-full resize-none bg-transparent text-[13px] leading-[1.5] text-ink outline-none"
                      />
                      <div className="mt-1.5 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => saveEdit(comment)}
                          className="cap flex h-7 items-center rounded-control bg-violet px-2.5 text-[12px] font-medium text-on-violet [--edge:var(--color-violet-edge)] hover:bg-violet-hover"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditing(null)}
                          className="cap flex h-7 items-center rounded-control border border-ink px-2.5 text-[12px] font-medium text-ink [--edge:var(--color-ink)] hover:bg-well"
                        >
                          Cancel
                        </button>
                        <span className="legend text-ink-3">
                          Esc cancels / Cmd+Enter saves
                        </span>
                      </div>
                    </div>
                  ) : (
                    <p
                      className={`mt-1 whitespace-pre-wrap text-[13px] leading-[1.5] ${
                        system ? "text-ink-3" : "text-ink"
                      }`}
                    >
                      {comment.body}
                    </p>
                  )}

                  {/* System entries carry no actions at all, in either
                      direction. Immutable is the whole point of them. */}
                  {!system && !deleted && editing !== comment.id ? (
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      {armed === comment.id ? (
                        <>
                          <span className="legend text-red">
                            Deleting in 3s
                          </span>
                          {action("Cancel", () => setArmed(null))}
                        </>
                      ) : (
                        <>
                          {action("Reply", () => setReplyTo(comment))}
                          {mine
                            ? action("Edit", () => {
                                setDraft(comment.body);
                                setEditing(comment.id);
                              })
                            : null}
                          {mine || isAdmin
                            ? action("Delete", () => setArmed(comment.id), true)
                            : null}
                        </>
                      )}
                    </div>
                  ) : null}
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <Composer
        taskId={taskId}
        members={members}
        meId={meId}
        replyTo={replyTo}
        onClearReply={() => setReplyTo(null)}
        replyToName={replyTo ? nameOf(replyTo.author_id) : null}
      />
    </div>
  );
}

/**
 * The comment box, with the @ picker.
 *
 * Typing @ opens a list of teammates. Picking one inserts the handle; the
 * server resolves handles to people again on save, which is what makes a
 * mention add a watcher without the browser ever naming a user id.
 */
function Composer({
  taskId,
  members,
  meId,
  replyTo,
  replyToName,
  onClearReply,
}: {
  taskId: string;
  members: OrgMember[];
  meId: string;
  replyTo: TaskCommentRow | null;
  replyToName: string | null;
  onClearReply: () => void;
}) {
  const router = useRouter();
  const { notify } = useToast();
  const [pending, startTransition] = useTransition();
  const [body, setBody] = useState("");
  const box = useRef<HTMLTextAreaElement>(null);

  // The partial handle under the cursor, if the caret is inside one.
  const handle = /(?:^|\s)@([a-z0-9._-]*)$/i.exec(body);
  const candidates = handle
    ? members.filter(
        (m) =>
          m.user_id !== meId &&
          m.display_name.toLowerCase().startsWith(handle[1].toLowerCase()),
      )
    : [];

  const pick = (member: OrgMember) => {
    const at = body.lastIndexOf("@");
    const token = member.email.split("@")[0];
    setBody(`${body.slice(0, at)}@${token} `);
    box.current?.focus();
  };

  const submit = () => {
    const text = body.trim();
    if (!text) return;
    setBody("");
    const parent = replyTo?.id ?? null;
    onClearReply();
    startTransition(async () => {
      const result = await addTaskComment(taskId, text, parent);
      if (!result.ok) {
        setBody(text);
        notify(`${result.error} The comment was not posted.`, "danger");
        return;
      }
      router.refresh();
    });
  };

  return (
    <div className="relative border-t border-rule p-3">
      {replyTo ? (
        <div className="mb-1.5 flex items-center gap-2">
          <span className="legend text-ink-3">Replying to {replyToName}</span>
          <button
            type="button"
            onClick={onClearReply}
            className="legend flex h-7 items-center rounded-chip border border-rule px-2 text-ink-3 hover:bg-well hover:text-ink"
          >
            Cancel
          </button>
        </div>
      ) : null}

      {candidates.length > 0 ? (
        <ul className="floating absolute bottom-full left-3 z-10 mb-1 w-56 overflow-hidden rounded-shell">
          {candidates.slice(0, 5).map((m) => (
            <li key={m.user_id}>
              <button
                type="button"
                onClick={() => pick(m)}
                className="flex w-full items-center gap-2 px-2.5 py-2 text-left text-[13px] text-ink hover:bg-well"
              >
                <Avatar name={m.display_name} size="sm" />
                {m.display_name}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <textarea
        ref={box}
        value={body}
        rows={2}
        disabled={pending}
        aria-label="Comment"
        placeholder="Comment, or @ someone to pull them in"
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            submit();
          }
        }}
        className="well w-full resize-none rounded-control px-2.5 py-2 text-[13px] leading-[1.5] text-ink outline-none placeholder:text-ink-3"
      />
      <div className="mt-1.5 flex items-center justify-between">
        <span className="legend text-ink-3">Cmd+Enter posts</span>
        <button
          type="button"
          onClick={submit}
          disabled={pending || !body.trim()}
          className="cap flex h-7 items-center rounded-control bg-violet px-3 text-[12px] font-medium text-on-violet [--edge:var(--color-violet-edge)] hover:bg-violet-hover disabled:cursor-not-allowed disabled:bg-well disabled:text-ink-3 disabled:shadow-none"
        >
          {pending ? "Posting" : "Post"}
        </button>
      </div>
    </div>
  );
}

/** "02 AUG", read inside the org's timezone. */
function stamp(iso: string, tz: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    day: "2-digit",
    month: "short",
  })
    .format(new Date(iso))
    .toUpperCase();
}
