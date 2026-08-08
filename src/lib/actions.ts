"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { requireSession } from "@/lib/auth";
import {
  buildShape,
  buildVoiceProfile,
  distilLesson,
} from "@/lib/server/ai/content";
import { hasModelKey } from "@/lib/server/ai/openai";
import { SURFACE_LIMITS } from "@/lib/server/ai/pricing";
import {
  type ConnectResult,
  connectWithCookie,
  connectWithCredentials,
  createHostedAuthLink,
  deleteAccount,
  getAccount,
  hasUnipile,
  resendCheckpoint,
  solveCheckpoint,
} from "@/lib/server/unipile";
import { createClient } from "@/lib/supabase/server";
import { type ParseMember, parseTaskInput } from "@/lib/task-parse";
import { dayKey } from "@/lib/time";
import { BD_FEEDBACK_TITLE, MANUAL_STATUSES } from "@/lib/supabase/types";
import type {
  BDAgentMemoryRow,
  BDMemoryKind,
  BDMemoryScope,
  ContentSkill,
  CustomFieldType,
  ManualPostStatus,
  PostStatus,
  SequenceStatus,
  TaskPriority,
  TaskStatus,
  VoiceProfile,
} from "@/lib/supabase/types";

// Every write lives here. Anything touching two or more tables calls an RPC;
// none of these reproduce a multi-table write client side.
//
// Each returns a typed result rather than throwing, so the UI can report the
// real reason a thing failed instead of a generic error, and never claims
// success it did not get (law 9).

export type Result<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

function fail(message: string): { ok: false; error: string } {
  return { ok: false, error: message };
}

const BD_MEMORY_KINDS = new Set<BDMemoryKind>([
  "positioning",
  "ideal_client",
  "buyer",
  "territory",
  "offer",
  "qualification",
  "preference",
  "feedback",
]);

function canManageAgencyStrategy(role: "owner" | "admin" | "member") {
  return role === "owner" || role === "admin";
}

// Postgres errors are not user copy. Translate the ones we deliberately caused.
function readable(message: string): string {
  if (message.includes("candidates_email_uniq")) {
    return "Someone with that email is already on this role.";
  }
  if (message.includes("companies_domain_uniq")) {
    return "That company domain is already in your list.";
  }
  if (message.includes("dream_domain_uniq")) {
    return "That company is already on your Dream 100.";
  }
  if (message.includes("mailboxes_address_uniq")) {
    return "That mailbox is already connected.";
  }
  if (message.includes("only admins")) {
    return "Only an admin can change credentials.";
  }
  return message;
}

export async function moveCandidate(
  candidateId: string,
  stageId: string,
): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("move_candidate", {
    candidate: candidateId,
    target_stage: stageId,
  });
  if (error) return fail(readable(error.message));

  revalidatePath("/pipeline", "layout");
  revalidatePath("/candidates");
  return { ok: true, data: undefined };
}

export async function bulkMoveCandidates(
  candidateIds: string[],
  stageId: string,
): Promise<Result<number>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("bulk_move_candidates", {
    candidate_ids: candidateIds,
    target_stage: stageId,
  });
  if (error) return fail(readable(error.message));

  revalidatePath("/pipeline", "layout");
  // Honest count: the RPC returns how many actually moved, not how many we asked for.
  return { ok: true, data: (data as number) ?? 0 };
}

export async function archiveCandidates(ids: string[]): Promise<Result<number>> {
  const supabase = await createClient();
  // select() after update returns the rows actually written, which is the
  // honest count. RLS may silently exclude ids from another org.
  const { data, error } = await supabase
    .from("candidates")
    .update({ archived_at: new Date().toISOString() })
    .in("id", ids)
    .select("id");
  if (error) return fail(readable(error.message));

  revalidatePath("/pipeline", "layout");
  return { ok: true, data: data?.length ?? 0 };
}

export async function deleteCandidates(ids: string[]): Promise<Result<number>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("delete_candidates", {
    candidate_ids: ids,
  });
  if (error) return fail(readable(error.message));

  revalidatePath("/pipeline", "layout");
  revalidatePath("/candidates");
  return { ok: true, data: (data as number) ?? 0 };
}

export async function createCandidate(input: {
  jobId: string;
  stageId: string;
  name: string;
  email: string;
  phone?: string;
  title?: string;
  company?: string;
}): Promise<Result<string>> {
  if (!input.name.trim()) return fail("Enter the candidate's name.");
  if (!input.email.trim()) return fail("Enter an email address.");

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_candidate", {
    target_job: input.jobId,
    target_stage: input.stageId,
    c_name: input.name.trim(),
    c_email: input.email.trim().toLowerCase(),
    c_phone: input.phone ?? "",
    c_title: input.title ?? "",
    c_company: input.company ?? "",
  });
  if (error) return fail(readable(error.message));

  revalidatePath("/pipeline", "layout");
  return { ok: true, data: data as string };
}

export async function addNote(
  candidateId: string,
  body: string,
): Promise<Result<string>> {
  if (!body.trim()) return fail("Write something first.");

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("add_note", {
    candidate: candidateId,
    note_body: body.trim(),
  });
  if (error) return fail(readable(error.message));

  revalidatePath("/pipeline", "layout");
  return { ok: true, data: data as string };
}

// Asking is not a server action: a research run streams for up to a minute and
// a server action cannot stream. It lives at POST /api/ask (AI.md section 7).
// The only server-side piece left here is the sweep, so a transcript with a
// dead run in it can be reconciled without asking a new question.
export async function sweepStalledAsks(): Promise<Result<number>> {
  const session = await requireSession();
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("sweep_stalled_asks", {
    target_org: session.org.id,
  });
  if (error) return fail(readable(error.message));

  revalidatePath("/market");
  revalidatePath("/ops");
  return { ok: true, data: (data as number) ?? 0 };
}

/**
 * Forget a research thread.
 *
 * The RLS policy allows this only for a thread you started, so a teammate's
 * history is not something an admin can clear. Messages cascade with it.
 */
export async function deleteConversation(id: string): Promise<Result> {
  await requireSession();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("chat_conversations")
    .delete()
    .eq("id", id)
    .select("id");
  if (error) return fail(readable(error.message));

  // RLS returns an empty set rather than an error when the policy says no.
  if (!data || data.length === 0) {
    return fail("Only the person who started that conversation can delete it.");
  }

  revalidatePath("/market");
  return { ok: true, data: undefined };
}

/* ---------------------------------------------------------------------------
 * BD Strategist memory (PLS-92, PLS-93)
 * ------------------------------------------------------------------------- */

export type SaveBDMemoryInput = {
  id?: string;
  scope: BDMemoryScope;
  kind: BDMemoryKind;
  title: string;
  body: string;
};

export type SaveBDFeedbackInput = {
  answerId: string;
  rating: "useful" | "off_target";
  note: string;
};

// Explicitly discriminated. Returning `{error?} | {title, body}` inferred a
// union where `error` was `string | undefined`, so the caller could not narrow
// it and every branch had to re-check.
type BDMemoryCheck =
  | { ok: false; error: string }
  | { ok: true; title: string; body: string };

function validateBDMemory(input: SaveBDMemoryInput): BDMemoryCheck {
  const title = input.title.trim();
  const body = input.body.trim();
  if (input.scope !== "agency" && input.scope !== "personal") {
    return { ok: false, error: "Choose whether this is agency strategy or your personal coaching." };
  }
  if (!BD_MEMORY_KINDS.has(input.kind)) {
    return { ok: false, error: "Choose a recognised type of BD context." };
  }
  if (title.length < 1 || title.length > 80) {
    return { ok: false, error: "Give this context a title of up to 80 characters." };
  }
  if (body.length < 1 || body.length > 2000) {
    return { ok: false, error: "Context needs between 1 and 2,000 characters." };
  }
  return { ok: true, title, body };
}

/** Save a visible piece of agency strategy or personal coaching context. */
export async function saveBDMemory(
  input: SaveBDMemoryInput,
): Promise<Result<BDAgentMemoryRow>> {
  const checked = validateBDMemory(input);
  if (!checked.ok) return fail(checked.error);

  const session = await requireSession();
  if (input.scope === "agency" && !canManageAgencyStrategy(session.role)) {
    return fail("Only an owner or admin can change agency strategy.");
  }

  const supabase = await createClient();

  if (input.id) {
    const { data: existing, error: readError } = await supabase
      .from("bd_agent_memories")
      .select("*")
      .eq("id", input.id)
      .maybeSingle();
    if (readError) return fail(readable(readError.message));
    if (!existing) return fail("That context is no longer available.");

    const memory = existing as BDAgentMemoryRow;
    if (memory.scope !== input.scope) {
      return fail("Keep agency strategy and personal coaching as separate records.");
    }
    if (
      (memory.scope === "agency" && !canManageAgencyStrategy(session.role)) ||
      (memory.scope === "personal" && memory.user_id !== session.userId)
    ) {
      return fail("You cannot change that context.");
    }

    const { data, error } = await supabase
      .from("bd_agent_memories")
      .update({ kind: input.kind, title: checked.title, body: checked.body })
      .eq("id", input.id)
      .select("*")
      .maybeSingle();
    if (error) return fail(readable(error.message));
    if (!data) return fail("That context was not saved.");
    return { ok: true, data: data as BDAgentMemoryRow };
  }

  const { data, error } = await supabase
    .from("bd_agent_memories")
    .insert({
      org_id: session.org.id,
      scope: input.scope,
      user_id: input.scope === "personal" ? session.userId : null,
      kind: input.kind,
      title: checked.title,
      body: checked.body,
      source: "manual",
    })
    .select("*")
    .single();
  if (error) return fail(readable(error.message));
  return { ok: true, data: data as BDAgentMemoryRow };
}

/** Delete context only when the visible row still belongs to the caller. */
export async function deleteBDMemory(memoryId: string): Promise<Result> {
  const session = await requireSession();
  const supabase = await createClient();
  const { data: existing, error: readError } = await supabase
    .from("bd_agent_memories")
    .select("id, scope, user_id")
    .eq("id", memoryId)
    .maybeSingle();
  if (readError) return fail(readable(readError.message));
  if (!existing) return fail("That context is already gone.");
  if (
    (existing.scope === "agency" && !canManageAgencyStrategy(session.role)) ||
    (existing.scope === "personal" && existing.user_id !== session.userId)
  ) {
    return fail("You cannot delete that context.");
  }

  const { data, error } = await supabase
    .from("bd_agent_memories")
    .delete()
    .eq("id", memoryId)
    .select("id");
  if (error) return fail(readable(error.message));
  if (!data?.length) return fail("That context was not deleted.");
  return { ok: true, data: undefined };
}

/**
 * A rating becomes visible personal coaching only when the recruiter explains
 * it. It is a unique per-answer correction so a repeated click refines rather
 * than contradicts the previous signal.
 */
export async function saveBDFeedback(
  input: SaveBDFeedbackInput,
): Promise<Result<BDAgentMemoryRow>> {
  const note = input.note.trim();
  if (input.rating !== "useful" && input.rating !== "off_target") {
    return fail("Choose whether the advice was useful or off target.");
  }
  if (input.rating === "off_target" && !note) {
    return fail("Say what the strategist should do differently next time.");
  }
  if (note.length > 1900) return fail("Keep feedback under 1,900 characters.");

  const session = await requireSession();
  const supabase = await createClient();
  const { data: answer, error: answerError } = await supabase
    .from("chat_messages")
    .select("id")
    .eq("id", input.answerId)
    .eq("org_id", session.org.id)
    .eq("surface", "market")
    .eq("role", "assistant")
    .eq("status", "complete")
    .maybeSingle();
  if (answerError) return fail(readable(answerError.message));
  if (!answer) return fail("That answer cannot be used for coaching feedback.");

  const title = BD_FEEDBACK_TITLE[input.rating];
  const body = note || "Keep this kind of grounded commercial advice coming.";
  const { data: existing, error: existingError } = await supabase
    .from("bd_agent_memories")
    .select("id")
    .eq("org_id", session.org.id)
    .eq("user_id", session.userId)
    .eq("answer_id", input.answerId)
    .eq("source", "feedback")
    .maybeSingle();
  if (existingError) return fail(readable(existingError.message));

  const write = existing
    ? supabase
        .from("bd_agent_memories")
        .update({ title, body })
        .eq("id", existing.id)
        .select("*")
        .single()
    : supabase
        .from("bd_agent_memories")
        .insert({
          org_id: session.org.id,
          scope: "personal",
          user_id: session.userId,
          kind: "feedback",
          title,
          body,
          source: "feedback",
          answer_id: input.answerId,
        })
        .select("*")
        .single();
  const { data, error } = await write;
  if (error) {
    // The partial unique index is the race guard. One retry turns a double
    // click into an update without weakening the constraint.
    if (error.code === "23505") {
      const { data: raced } = await supabase
        .from("bd_agent_memories")
        .select("id")
        .eq("org_id", session.org.id)
        .eq("user_id", session.userId)
        .eq("answer_id", input.answerId)
        .eq("source", "feedback")
        .maybeSingle();
      if (raced) {
        const retry = await supabase
          .from("bd_agent_memories")
          .update({ title, body })
          .eq("id", raced.id)
          .select("*")
          .single();
        if (!retry.error) return { ok: true, data: retry.data as BDAgentMemoryRow };
      }
    }
    return fail(readable(error.message));
  }

  return { ok: true, data: data as BDAgentMemoryRow };
}

/**
 * Complete or reopen a task.
 *
 * An RPC, not an update: completing writes the task row AND the activity entry
 * that records who did it, and law 1 says two tables is one function. The old
 * version wrote status and done_at from the client and stamped nobody, which
 * is why a finished row could never say "completed by you".
 *
 * No revalidatePath. The row is already right on screen through the optimistic
 * overlay, the 4s undo window lives entirely in the client, and revalidating
 * mid-window would yank the row out from under the Undo button.
 */
export async function completeTask(
  taskId: string,
  done: boolean,
): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("complete_task", {
    target_task: taskId,
    done,
  });
  if (error) return fail(readable(error.message));
  return { ok: true, data: undefined };
}

/** Move a task through its lifecycle. Completed stamps the time, per the constraint. */
export async function setTaskStatus(
  taskId: string,
  status: TaskStatus,
): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("tasks")
    .update({
      status,
      done_at: status === "completed" ? new Date().toISOString() : null,
    })
    .eq("id", taskId);
  if (error) return fail(readable(error.message));

  // No revalidate: the dropdown patches optimistically and the row is already
  // right on screen. A revalidate here would fight the optimistic state.
  return { ok: true, data: undefined };
}

export async function setTaskPriority(
  taskId: string,
  priority: TaskPriority,
): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("tasks")
    .update({ priority })
    .eq("id", taskId);
  if (error) return fail(readable(error.message));
  return { ok: true, data: undefined };
}

export async function setTaskDue(
  taskId: string,
  due: string | null,
): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("tasks")
    .update({ due })
    .eq("id", taskId);
  if (error) return fail(readable(error.message));
  return { ok: true, data: undefined };
}

/**
 * Replace who owns a task. One RPC, because delete-then-insert as two client
 * calls wipes every assignee when the second call fails, while the action
 * still reports success. The RPC also writes the notifications for anyone
 * newly added, inside the same transaction.
 */
export async function setTaskAssignees(
  taskId: string,
  userIds: string[],
): Promise<Result<number>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("replace_task_assignees", {
    target_task: taskId,
    new_users: userIds,
  });
  if (error) return fail(readable(error.message));
  return { ok: true, data: (data as number) ?? 0 };
}

export async function createTask(
  title: string,
  detail: string,
  options?: {
    due?: string | null;
    priority?: TaskPriority;
    assigneeIds?: string[];
    candidateId?: string | null;
    companyId?: string | null;
  },
): Promise<Result> {
  if (!title.trim()) return fail("Give the task a title.");

  const session = await requireSession();
  const supabase = await createClient();

  // next_ref has EXECUTE revoked from client roles on purpose, so ref
  // allocation happens inside the RPC rather than as a separate call. The RPC
  // also attaches the assignees, so a crash cannot strand a task half-created.
  const { error } = await supabase.rpc("create_task", {
    target_org: session.org.id,
    task_title: title.trim(),
    task_detail: detail.trim(),
    ...(options?.due !== undefined ? { task_due: options.due } : {}),
    ...(options?.priority ? { task_priority_in: options.priority } : {}),
    ...(options?.assigneeIds?.length
      ? { assignee_ids: options.assigneeIds }
      : {}),
    ...(options?.candidateId ? { linked_candidate: options.candidateId } : {}),
    ...(options?.companyId ? { linked_company: options.companyId } : {}),
  });
  if (error) return fail(readable(error.message));

  revalidatePath("/ops/tasks");
  return { ok: true, data: undefined };
}

/* ---------------------------------------------------------------------------
 * The tasks workspace (PLS-111)
 * ------------------------------------------------------------------------- */

/**
 * Add a task from the sentence somebody typed.
 *
 * The browser parses the same string to draw the reads-as row, and this parses
 * it again. That is deliberate: a client that posts the due date, the priority
 * and the assignee ids it decided on is a client the server has taken at its
 * word, and the reads-as row exists precisely so nobody is surprised by what
 * the server concluded. Same parser, same directory, one truth.
 */
export async function createTaskFromText(raw: string): Promise<Result> {
  const text = raw.trim();
  if (!text) return fail("Type what needs doing.");

  const session = await requireSession();
  const supabase = await createClient();

  const [{ data: members }, { data: candidates }, { data: companies }] =
    await Promise.all([
      supabase.rpc("org_members", { target_org: session.org.id }),
      supabase.from("candidates").select("id, name").is("archived_at", null),
      supabase.from("companies").select("id, name"),
    ]);

  const parsed = parseTaskInput(text, {
    todayKey: dayKey(new Date(), session.org.timezone),
    tz: session.org.timezone,
    members: (members ?? []) as ParseMember[],
    links: [
      ...((candidates ?? []) as { id: string; name: string }[]).map((c) => ({
        ...c,
        kind: "candidate" as const,
      })),
      ...((companies ?? []) as { id: string; name: string }[]).map((c) => ({
        ...c,
        kind: "company" as const,
      })),
    ],
  });

  // Everything the sentence carried was metadata. There is no task left.
  if (!parsed.title) return fail("That is a date and an owner with no task on it.");

  return createTask(parsed.title, "", {
    due: parsed.due,
    priority: parsed.priority ?? "normal",
    assigneeIds: parsed.assignees.map((a) => a.user_id),
    candidateId: parsed.link?.kind === "candidate" ? parsed.link.id : null,
    companyId: parsed.link?.kind === "company" ? parsed.link.id : null,
  });
}

/**
 * Say something on a task.
 *
 * The @handles are resolved here rather than sent as ids, for the same reason
 * the quick add re-parses: a client-supplied list of user ids to add as
 * watchers is a client-supplied list of people to notify. The RPC then does
 * the comment, the watchers and the notifications in one transaction.
 */
export async function addTaskComment(
  taskId: string,
  body: string,
  replyTo?: string | null,
): Promise<Result> {
  const text = body.trim();
  if (!text) return fail("Write something first.");

  const session = await requireSession();
  const supabase = await createClient();

  const { data: members } = await supabase.rpc("org_members", {
    target_org: session.org.id,
  });

  const mentioned = mentionedUsers(text, (members ?? []) as ParseMember[]);

  const { error } = await supabase.rpc("add_task_comment", {
    target_task: taskId,
    comment_body: text,
    mention_users: mentioned,
    ...(replyTo ? { parent: replyTo } : {}),
  });
  if (error) return fail(readable(error.message));
  return { ok: true, data: undefined };
}

export async function editTaskComment(
  commentId: string,
  body: string,
): Promise<Result> {
  const text = body.trim();
  if (!text) return fail("A comment needs some words.");

  const supabase = await createClient();
  const { error } = await supabase.rpc("edit_task_comment", {
    target_comment: commentId,
    new_body: text,
  });
  if (error) return fail(readable(error.message));
  return { ok: true, data: undefined };
}

/**
 * Remove a comment. Returns what actually happened, because the two outcomes
 * look different on screen: a tombstone stays in the stream and a removal does
 * not, and a UI that guesses will animate the wrong one.
 */
export async function deleteTaskComment(
  commentId: string,
): Promise<Result<"tombstoned" | "removed">> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("delete_task_comment", {
    target_comment: commentId,
  });
  if (error) return fail(readable(error.message));
  return { ok: true, data: (data as "tombstoned" | "removed") ?? "removed" };
}

/** Follow or stop following a task. Your own row, so it needs no RPC. */
export async function setTaskWatching(
  taskId: string,
  watching: boolean,
): Promise<Result> {
  const session = await requireSession();
  const supabase = await createClient();

  if (!watching) {
    const { error } = await supabase
      .from("task_watchers")
      .delete()
      .eq("task_id", taskId)
      .eq("user_id", session.userId);
    if (error) return fail(readable(error.message));
    return { ok: true, data: undefined };
  }

  // Law 2: the primary key is the race guard, so this is an insert that
  // tolerates a conflict rather than a select followed by an insert.
  const { error } = await supabase
    .from("task_watchers")
    .upsert(
      { task_id: taskId, user_id: session.userId, org_id: session.org.id },
      { onConflict: "task_id,user_id", ignoreDuplicates: true },
    );
  if (error) return fail(readable(error.message));
  return { ok: true, data: undefined };
}

/** Which teammates a comment names. Same handle matching as the quick add. */
function mentionedUsers(text: string, members: ParseMember[]): string[] {
  const ids = new Set<string>();
  for (const match of text.matchAll(/(?:^|\s)@([a-z0-9._-]+)/gi)) {
    const wanted = match[1].toLowerCase();
    const found =
      members.find((m) => m.email.split("@")[0].toLowerCase() === wanted) ??
      members.find((m) => m.display_name.toLowerCase() === wanted) ??
      members.find(
        (m) => m.display_name.split(/\s+/)[0].toLowerCase() === wanted,
      );
    if (found) ids.add(found.user_id);
  }
  return [...ids];
}

/* ---------------------------------------------------------------------------
 * Persona and shapes (PLS-81, PLS-82)
 * ------------------------------------------------------------------------- */

/**
 * Save the intake and distil a voice from it.
 *
 * Reserves before the provider call and settles after, like every other paid
 * call in the product. The raw material is written first: if the model call
 * fails, what they pasted is still saved and they can retry the distillation
 * without typing it all again.
 */
export async function buildPersona(input: {
  headline: string;
  about: string;
  proudPosts: string[];
  flopPosts: string[];
}): Promise<Result<VoiceProfile>> {
  const session = await requireSession();
  const supabase = await createClient();

  if (!hasModelKey()) {
    return fail(
      "Post generation is not switched on for this deployment yet, so there is no model to read your voice with.",
    );
  }

  const proud = input.proudPosts.map((p) => p.trim()).filter(Boolean);
  const flop = input.flopPosts.map((p) => p.trim()).filter(Boolean);

  // Law 2: the unique index on user_id is the race guard, so this is an upsert
  // rather than a read followed by an insert.
  const { data: saved, error: saveError } = await supabase
    .from("content_personas")
    .upsert(
      {
        org_id: session.org.id,
        user_id: session.userId,
        headline: input.headline.trim(),
        about: input.about.trim(),
        proud_posts: proud,
        flop_posts: flop,
      },
      { onConflict: "user_id" },
    )
    .select("id")
    .single();
  if (saveError) return fail(readable(saveError.message));

  const limits = SURFACE_LIMITS.content;
  const { data: claim, error: claimError } = await supabase.rpc("begin_ask", {
    target_org: session.org.id,
    target_surface: "content",
    question: "Build my persona",
    reserve: limits.reserveCredits,
  });
  if (claimError) return fail(readable(claimError.message));
  if (!claim) {
    return fail(
      "Your credit allowance for this week is spent, so the persona was not built. What you pasted is saved.",
    );
  }

  const messageId = (claim as { message_id: string }).message_id;

  try {
    const outcome = await buildVoiceProfile({
      headline: input.headline,
      about: input.about,
      proudPosts: proud,
      flopPosts: flop,
    });

    const { error: writeError } = await supabase
      .from("content_personas")
      .update({
        voice_profile: outcome.profile,
        built_at: new Date().toISOString(),
      })
      .eq("id", saved.id);
    if (writeError) return fail(readable(writeError.message));

    await supabase.rpc("finish_ask", {
      message: messageId,
      answer_body: outcome.profile.summary ?? "",
      answer_sources: [],
      actual_cost: outcome.credits,
      run_status: "complete",
      answer_meta: outcome.meta,
      error_text: null,
    });

    revalidatePath("/content", "layout");
    return { ok: true, data: outcome.profile };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "The persona could not be built. Nothing was charged.";
    // Refund in full. A failed run spends nothing (AI.md section 3).
    await supabase.rpc("finish_ask", {
      message: messageId,
      answer_body: "",
      answer_sources: [],
      actual_cost: 0,
      run_status: "failed",
      answer_meta: {},
      error_text: message,
    });
    return fail(message);
  }
}

/** Edit the distilled voice by hand. It is theirs to correct. */
export async function updateVoiceProfile(
  profile: VoiceProfile,
): Promise<Result> {
  const session = await requireSession();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("content_personas")
    .update({ voice_profile: profile })
    .eq("user_id", session.userId)
    .select("id");
  if (error) return fail(readable(error.message));
  if (!data || data.length === 0) return fail("You have no persona to update yet.");

  revalidatePath("/content", "layout");
  return { ok: true, data: undefined };
}

/** Fold a lesson into the voice, or discard it. Never silent, either way. */
export async function applyLesson(
  lessonId: string,
  keep: boolean,
): Promise<Result> {
  const session = await requireSession();
  const supabase = await createClient();

  const { data: lesson, error: readError } = await supabase
    .from("persona_lessons")
    .select("id, lesson, persona_id")
    .eq("id", lessonId)
    .maybeSingle();
  if (readError) return fail(readable(readError.message));
  if (!lesson) return fail("That lesson is already gone.");

  if (keep) {
    const { data: persona } = await supabase
      .from("content_personas")
      .select("voice_profile")
      .eq("id", lesson.persona_id)
      .eq("user_id", session.userId)
      .maybeSingle();
    if (!persona) return fail("That persona is not yours to change.");

    const profile = (persona.voice_profile ?? {}) as VoiceProfile;
    const learned = [...(profile.proof ?? []), lesson.lesson];
    const { error: writeError } = await supabase
      .from("content_personas")
      .update({ voice_profile: { ...profile, proof: learned } })
      .eq("id", lesson.persona_id);
    if (writeError) return fail(readable(writeError.message));
  }

  // Marking it applied either way is what stops a discarded lesson coming back
  // to be reviewed every time the screen loads.
  const { error } = await supabase
    .from("persona_lessons")
    .update({ applied_at: new Date().toISOString() })
    .eq("id", lessonId);
  if (error) return fail(readable(error.message));

  revalidatePath("/content", "layout");
  return { ok: true, data: undefined };
}

/**
 * Draft a shape from a sentence. Does not save: the caller edits it first.
 *
 * Metered like every other provider call, on the content surface, so a shape
 * that costs money to draft is a shape the ledger knows about.
 */
export async function draftShape(
  description: string,
): Promise<Result<{ name: string; blurb: string; prompt: string }>> {
  const session = await requireSession();
  const supabase = await createClient();

  if (!hasModelKey()) {
    return fail(
      "This deployment has no model key, so nothing can be drafted. You can still write the frame by hand.",
    );
  }

  const limits = SURFACE_LIMITS.content;
  const { data: claim, error: claimError } = await supabase.rpc("begin_ask", {
    target_org: session.org.id,
    target_surface: "content",
    question: `Design a shape: ${description}`,
    reserve: limits.reserveCredits,
  });
  if (claimError) return fail(readable(claimError.message));
  if (!claim) {
    return fail(
      "Your credit allowance for this week is spent, so nothing was drafted and nothing was charged.",
    );
  }

  const messageId = (claim as { message_id: string }).message_id;

  try {
    const outcome = await buildShape({ description });

    await supabase.rpc("finish_ask", {
      message: messageId,
      answer_body: outcome.shape.name,
      answer_sources: [],
      actual_cost: outcome.credits,
      run_status: "complete",
      answer_meta: outcome.meta,
      error_text: null,
    });

    return { ok: true, data: outcome.shape };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "The shape could not be drafted. Nothing was charged.";
    await supabase.rpc("finish_ask", {
      message: messageId,
      answer_body: "",
      answer_sources: [],
      actual_cost: 0,
      run_status: "failed",
      answer_meta: {},
      error_text: message,
    });
    return fail(message);
  }
}

/** Add a post shape this org can write through. */
export async function createShape(input: {
  name: string;
  blurb: string;
  prompt: string;
}): Promise<Result> {
  const name = input.name.trim();
  const prompt = input.prompt.trim();
  if (!name) return fail("Give the shape a name.");
  if (!prompt) return fail("Describe what this shape asks for.");

  const session = await requireSession();
  const supabase = await createClient();

  // The key is derived once and never changes, so renaming later cannot orphan
  // the posts already written through it.
  const key = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
  if (!key) return fail("That name has no usable characters.");

  const { count } = await supabase
    .from("content_shapes")
    .select("id", { count: "exact", head: true });

  const { error } = await supabase.from("content_shapes").insert({
    org_id: session.org.id,
    key,
    name,
    blurb: input.blurb.trim(),
    prompt,
    created_by: session.userId,
    sort: count ?? 0,
  });
  if (error) {
    if (error.code === "23505") return fail("A shape with that name already exists.");
    return fail(readable(error.message));
  }

  revalidatePath("/content", "layout");
  return { ok: true, data: undefined };
}

export async function deleteShape(shapeId: string): Promise<Result> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("content_shapes")
    .delete()
    .eq("id", shapeId)
    .select("id");
  if (error) return fail(readable(error.message));
  if (!data || data.length === 0) return fail("That shape was already gone.");

  revalidatePath("/content", "layout");
  return { ok: true, data: undefined };
}

/* ---------------------------------------------------------------------------
 * Public application links (PLS-78)
 * ------------------------------------------------------------------------- */

/** Mint the public application link for a job. The slug is the capability. */
export async function enableApplications(
  jobId: string,
): Promise<Result<string>> {
  const supabase = await createClient();

  // 24 random bytes of URL-safe alphabet. Unguessable is the security model.
  const slug = Array.from(crypto.getRandomValues(new Uint8Array(24)))
    .map((b) => "abcdefghijklmnopqrstuvwxyz0123456789"[b % 36])
    .join("");

  const { data, error } = await supabase
    .from("jobs")
    .update({ application_slug: slug })
    .eq("id", jobId)
    .select("application_slug");
  if (error) return fail(readable(error.message));
  if (!data || data.length === 0) return fail("That role was not updated.");

  revalidatePath("/pipeline", "layout");
  return { ok: true, data: slug };
}

/** Revoke the link. Every copy ever shared stops working at once. */
export async function disableApplications(jobId: string): Promise<Result> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("jobs")
    .update({ application_slug: null })
    .eq("id", jobId)
    .select("id");
  if (error) return fail(readable(error.message));
  if (!data || data.length === 0) return fail("That role was not updated.");

  revalidatePath("/pipeline", "layout");
  return { ok: true, data: undefined };
}

/**
 * The public submission. The caller has no session, so the server client runs
 * as anon and the RPC's own validation is the whole boundary. Nothing here
 * may leak whether an email already applied: a repeat is a quiet success.
 */
export async function submitApplication(input: {
  slug: string;
  name: string;
  email: string;
  phone?: string;
  title?: string;
  company?: string;
  linkedin?: string;
}): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("apply_to_job", {
    slug: input.slug,
    applicant_name: input.name,
    applicant_email: input.email,
    applicant_phone: input.phone ?? "",
    applicant_title: input.title ?? "",
    applicant_company: input.company ?? "",
    applicant_linkedin: input.linkedin ?? "",
  });
  if (error) return fail(readable(error.message));
  return { ok: true, data: undefined };
}

/* ---------------------------------------------------------------------------
 * Custom fields (PLS-77)
 * ------------------------------------------------------------------------- */

/**
 * Patch one custom field on a candidate. The merge happens in SQL, so two
 * people editing two different fields on the same person cannot eat each
 * other's writes the way a client-side read-modify-write would.
 */
export async function setCandidateField(
  candidateId: string,
  key: string,
  value: string,
): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_candidate_field", {
    target_candidate: candidateId,
    field_key: key,
    field_value: value,
  });
  if (error) return fail(readable(error.message));
  // No revalidate: called on blur from inside the open drawer.
  return { ok: true, data: undefined };
}

/** Define a new custom column. Admin only, enforced by RLS. */
export async function createFieldDef(input: {
  label: string;
  fieldType: CustomFieldType;
  options?: string[];
}): Promise<Result> {
  const label = input.label.trim();
  if (!label) return fail("Give the field a name.");

  const session = await requireSession();
  const supabase = await createClient();

  // The key is derived once at creation and never changes, so renaming the
  // label later cannot orphan every stored value.
  const key = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
  if (!key) return fail("That name has no usable characters.");

  const { count } = await supabase
    .from("person_field_defs")
    .select("id", { count: "exact", head: true });

  const { error } = await supabase.from("person_field_defs").insert({
    org_id: session.org.id,
    key,
    label,
    field_type: input.fieldType,
    options: input.options ?? [],
    sort: count ?? 0,
  });
  if (error) {
    if (error.code === "23505") {
      return fail("A field with that name already exists.");
    }
    if (error.code === "42501") {
      return fail("Only an admin can define fields.");
    }
    return fail(readable(error.message));
  }
  return { ok: true, data: undefined };
}

/** Remove a custom column definition. The stored values become invisible. */
export async function deleteFieldDef(defId: string): Promise<Result> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("person_field_defs")
    .delete()
    .eq("id", defId)
    .select("id");
  if (error) return fail(readable(error.message));
  if (!data || data.length === 0) {
    return fail("That field was not removed. Only an admin can manage fields.");
  }
  return { ok: true, data: undefined };
}

/** Mark every unread notification read. RLS scopes it to the caller's rows. */
export async function markNotificationsRead(): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .is("read_at", null);
  if (error) return fail(readable(error.message));

  revalidatePath("/", "layout");
  return { ok: true, data: undefined };
}

export async function setSequenceStatus(
  sequenceId: string,
  status: SequenceStatus,
): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("sequences")
    .update({ status })
    .eq("id", sequenceId);
  if (error) return fail(readable(error.message));

  revalidatePath("/sequences");
  return { ok: true, data: undefined };
}

export async function updateStep(
  stepId: string,
  patch: { subject?: string; body?: string },
): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("sequence_steps")
    .update(patch)
    .eq("id", stepId);
  if (error) return fail(readable(error.message));
  // No revalidate: the editor is a controlled input and revalidating under an
  // open editor is the remount bug CLAUDE.md forbids.
  return { ok: true, data: undefined };
}

export async function reconnectMailbox(mailboxId: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("mailboxes")
    .update({ status: "warming" })
    .eq("id", mailboxId);
  if (error) return fail(readable(error.message));

  revalidatePath("/mailboxes");
  return { ok: true, data: undefined };
}

export async function dismissSignal(signalId: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("signals")
    .update({ dismissed_at: new Date().toISOString() })
    .eq("id", signalId);
  if (error) return fail(readable(error.message));

  revalidatePath("/signals");
  return { ok: true, data: undefined };
}

/**
 * Add a post, optionally already on a day.
 *
 * `when` is an absolute instant the caller resolved inside the org timezone.
 * The RPC takes it so that creating a dated post is one write: the earlier
 * two-step needed the new row's id, which meant finding it again by its text.
 */
export async function createPost(
  skill: ContentSkill,
  hook: string,
  when: string | null = null,
): Promise<Result<string>> {
  if (!hook.trim()) return fail("Write the hook first.");

  const session = await requireSession();
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("create_post", {
    target_org: session.org.id,
    post_skill: skill,
    post_hook: hook.trim(),
    post_when: when,
  });
  if (error) return fail(readable(error.message));

  revalidatePath("/content");
  return { ok: true, data: data as string };
}

/**
 * Add a post that already has words in it.
 *
 * create_post owns ref allocation, so the row is made there and the body,
 * shape and generated snapshot are written straight after. Two statements
 * rather than an RPC change, because the second is a plain single-table update
 * on a row this caller just created and RLS already scopes.
 *
 * `generated` is the draft exactly as the model wrote it. Keeping it is what
 * makes the persona able to learn later: without it, an edit is just a body
 * with no before to compare against.
 */
export async function createWrittenPost(input: {
  skill: ContentSkill;
  shapeId: string | null;
  hook: string;
  body: string;
  when: string | null;
  generated: string | null;
}): Promise<Result<string>> {
  if (!input.hook.trim()) return fail("The post needs a first line.");

  const session = await requireSession();
  const supabase = await createClient();

  const { data: id, error } = await supabase.rpc("create_post", {
    target_org: session.org.id,
    post_skill: input.skill,
    post_hook: input.hook.trim(),
    post_when: input.when,
  });
  if (error) return fail(readable(error.message));

  const { error: writeError } = await supabase
    .from("content_posts")
    .update({
      body: input.body,
      shape_id: input.shapeId,
      generated_body: input.generated,
      // A dated post is already 'scheduled' from the RPC. An undated one with
      // a body is drafted, not an idea: the words exist.
      ...(input.when ? {} : { status: "drafted" as const }),
    })
    .eq("id", id as string);
  if (writeError) return fail(readable(writeError.message));

  revalidatePath("/content");
  return { ok: true, data: id as string };
}

export async function setPostStatus(
  postId: string,
  status: ManualPostStatus,
): Promise<Result> {
  // `publishing` and `failed` belong to the cron. Accepting either from a
  // client would let a stray call mark a post as in flight, which the claim
  // would then skip forever.
  if (!MANUAL_STATUSES.includes(status)) {
    return fail("That is not a status a post can be moved to by hand.");
  }

  const supabase = await createClient();
  const patch: {
    status: PostStatus;
    scheduled_for?: string;
    published_at?: string | null;
  } = { status };

  // The database refuses a scheduled row with no date and a published row with
  // no time, so the action supplies them rather than letting the constraint
  // surface as a raw Postgres error.
  if (status === "scheduled") {
    patch.scheduled_for = new Date(Date.now() + 86_400_000).toISOString();
  }
  if (status === "published") {
    patch.published_at = new Date().toISOString();
  } else {
    patch.published_at = null;
  }

  // `neq status publishing` is the race guard. Between a claim and LinkedIn
  // answering there is a window where the post is already on its way out;
  // moving it back to a draft in that window would leave the row lying about
  // something that has already been published.
  const { data: moved, error } = await supabase
    .from("content_posts")
    .update(patch)
    .eq("id", postId)
    .neq("status", "publishing")
    .select("id");
  if (error) return fail(readable(error.message));

  if (!moved || moved.length === 0) {
    return fail(
      "That post is being published right now, so it cannot be changed. Give it a moment and reload.",
    );
  }

  // Publishing a post that was generated and then edited is the moment the
  // persona has something real to learn from. Deliberately after the status
  // write and deliberately not awaited for its result: a lesson is a bonus,
  // and it must never be the reason marking a post published fails.
  if (status === "published") {
    void recordLesson(postId);
  }

  revalidatePath("/content");
  return { ok: true, data: undefined };
}

/**
 * Distil what an edit says about the author's voice.
 *
 * Silent by design at the point of capture, visible at the point of effect:
 * the row lands unapplied and shows up on the persona screen for review. What
 * this must never do is change the voice on its own.
 */
async function recordLesson(postId: string): Promise<void> {
  try {
    const session = await requireSession();
    const supabase = await createClient();

    const { data: post } = await supabase
      .from("content_posts")
      .select("id, org_id, body, generated_body, author_id")
      .eq("id", postId)
      .maybeSingle();

    // Nothing to compare against, or somebody else's post.
    if (!post?.generated_body || post.author_id !== session.userId) return;
    if (post.body.trim() === post.generated_body.trim()) return;

    // One lesson per post. Closing the dialog is now what captures a lesson,
    // and a post can be opened and closed all day: without this, one edited
    // post would file a near-identical lesson every time and burn a model call
    // on each. A later edit that is worth learning from replaces this row
    // rather than joining it, see the upsert below.
    // Newest first with a limit rather than maybeSingle: there is no unique
    // index on post_id, and maybeSingle throws on more than one row, which
    // would silently kill learning for any post that already has two.
    const { data: seenRows } = await supabase
      .from("persona_lessons")
      .select("id, applied_at")
      .eq("post_id", post.id)
      .order("created_at", { ascending: false })
      .limit(1);
    const seen = seenRows?.[0];
    // Already reviewed and applied: the voice has moved on and re-teaching it
    // from the same post would drag it backwards.
    if (seen?.applied_at) return;

    const { data: persona } = await supabase
      .from("content_personas")
      .select("id")
      .eq("user_id", session.userId)
      .maybeSingle();
    if (!persona) return;

    if (!hasModelKey()) return;

    const outcome = await distilLesson({
      generated: post.generated_body,
      published: post.body,
    });
    // A typo fix teaches nothing, and filling the review list with noise is
    // how someone stops reading it.
    if (!outcome.lesson) return;

    const row = {
      org_id: post.org_id,
      persona_id: persona.id,
      post_id: post.id,
      generated: post.generated_body,
      published: post.body,
      lesson: outcome.lesson,
    };

    // Replace the pending lesson rather than adding a second one. Someone who
    // edits, closes, reopens and edits again should teach the persona what
    // they settled on, not both drafts.
    if (seen) {
      await supabase
        .from("persona_lessons")
        .update({ ...row, created_at: new Date().toISOString() })
        .eq("id", seen.id);
      return;
    }

    await supabase.from("persona_lessons").insert(row);
  } catch {
    // Learning is opportunistic. A failure here is invisible on purpose:
    // nothing the user did has gone wrong.
  }
}

/**
 * Put a post on a day, or take it off one.
 *
 * `when` is an absolute instant the caller has already resolved inside the org
 * timezone, so this never has to guess what "the 4th at nine" means. Passing
 * null sends the post back to the backlog.
 */
export async function schedulePost(
  postId: string,
  when: string | null,
): Promise<Result> {
  const supabase = await createClient();

  // A published post keeps its status: dragging it to a different square moves
  // the record of when it went out, it does not un-publish it.
  const { data: existing, error: readError } = await supabase
    .from("content_posts")
    .select("status, body")
    .eq("id", postId)
    .maybeSingle();
  if (readError) return fail(readable(readError.message));
  if (!existing) return fail("That post no longer exists.");

  if (existing.status === "publishing") {
    return fail(
      "That post is being published right now, so it cannot be moved. Give it a moment and reload.",
    );
  }

  const status: PostStatus =
    existing.status === "published"
      ? "published"
      : when
        ? "scheduled"
        : existing.body.trim()
          ? "drafted"
          : "idea";

  const { data: moved, error } = await supabase
    .from("content_posts")
    .update({
      scheduled_for: when,
      status,
      // Giving a failed post a new date is how you retry it. The error came
      // from the last attempt and would be a lie on the next one, and the
      // attempt count resets or three old failures would block the claim.
      ...(existing.status === "failed"
        ? { publish_error: null, publish_attempts: 0 }
        : {}),
    })
    .eq("id", postId)
    .neq("status", "publishing")
    .select("id");
  if (error) return fail(readable(error.message));

  if (!moved || moved.length === 0) {
    return fail(
      "That post started publishing while you were moving it. Reload to see where it landed.",
    );
  }

  revalidatePath("/content");
  return { ok: true, data: undefined };
}

/**
 * Put a failed post back in the queue.
 *
 * PLS-88. A failure is terminal on purpose: the publisher does not keep
 * retrying something LinkedIn refused. This is the deliberate second go, and it
 * clears the attempt count, because three old failures would otherwise make the
 * claim skip the row no matter what was fixed.
 *
 * The new time is now, not the original one: a post whose slot passed while it
 * was failing should go out when the person retrying it says so.
 */
export async function retryPost(postId: string): Promise<Result> {
  const supabase = await createClient();

  const { data: moved, error } = await supabase
    .from("content_posts")
    .update({
      status: "scheduled" as const,
      scheduled_for: new Date().toISOString(),
      publish_error: null,
      publish_attempts: 0,
      auto_publish: true,
    })
    .eq("id", postId)
    .eq("status", "failed")
    .select("id");
  if (error) return fail(readable(error.message));

  if (!moved || moved.length === 0) {
    return fail("Only a post that failed to publish can be retried.");
  }

  revalidatePath("/content");
  return { ok: true, data: undefined };
}

/**
 * Edit the words. Single table, so no RPC is owed.
 *
 * `settled` says the user has finished with this post rather than paused
 * mid-sentence: the dialog is closing. The body saves on every blur, and
 * distilling a lesson costs a model call, so learning on each one would spend
 * credits on half-written text and fill the review list with noise. Passing it
 * captures the lesson once, from the version they actually left behind.
 */
export async function updatePost(
  postId: string,
  patch: { hook?: string; body?: string; skill?: ContentSkill },
  settled = false,
): Promise<Result> {
  if (patch.hook !== undefined && !patch.hook.trim()) {
    return fail("A post still needs a hook.");
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("content_posts")
    .update({
      ...(patch.hook !== undefined ? { hook: patch.hook.trim() } : {}),
      ...(patch.body !== undefined ? { body: patch.body } : {}),
      ...(patch.skill !== undefined ? { skill: patch.skill } : {}),
    })
    .eq("id", postId);
  if (error) return fail(readable(error.message));

  // The edit IS the lesson, so this is the moment to read it. Previously the
  // only caller was "Mark published", which meant editing a generated post and
  // letting the publisher send it taught the persona nothing at all.
  //
  // Deliberately not awaited: a lesson is a bonus, and it must never be the
  // reason saving an edit is slow or fails. recordLesson refuses a post that
  // matches what was generated, so an unchanged draft costs nothing.
  if (settled && patch.body !== undefined) {
    void recordLesson(postId);
  }

  // No revalidate. This is called from an open dialog, and revalidating under
  // an open layer remounts it and drops what the user is typing.
  return { ok: true, data: undefined };
}

/**
 * Delete a post and its media.
 *
 * The RPC removes both sets of rows in one transaction and hands back the
 * storage paths. The blobs go afterwards, per law 4: an orphan blob costs
 * pennies, a row pointing at a blob that is gone is a broken screen. A storage
 * failure here is reported rather than swallowed, because the rows really are
 * gone and the caller should know the bucket still holds the files.
 */
export async function deletePost(postId: string): Promise<Result> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("delete_post", {
    target_post: postId,
  });
  if (error) return fail(readable(error.message));

  const paths = (data as string[] | null) ?? [];
  if (paths.length > 0) {
    const { error: storageError } = await supabase.storage
      .from("content-media")
      .remove(paths);
    if (storageError) {
      revalidatePath("/content");
      return fail(
        `The post is deleted, but ${paths.length} file${paths.length === 1 ? "" : "s"} could not be removed from storage: ${storageError.message}`,
      );
    }
  }

  revalidatePath("/content");
  return { ok: true, data: undefined };
}

/**
 * A signed upload URL for one file, and the path it will land at.
 *
 * The browser uploads straight to storage rather than through a server action,
 * because a 200MB video through an action is a 200MB request body. The path is
 * org-prefixed so the storage policy can authorise it by its first segment.
 */
export async function createUploadUrl(
  postId: string,
  fileName: string,
): Promise<Result<{ path: string; token: string }>> {
  const session = await requireSession();
  const supabase = await createClient();

  // Confirm the post is ours before minting anything. RLS would catch a foreign
  // id on the insert later, but a signed URL should not exist at all for a post
  // the caller cannot see.
  const { data: post, error: readError } = await supabase
    .from("content_posts")
    .select("id")
    .eq("id", postId)
    .maybeSingle();
  if (readError) return fail(readable(readError.message));
  if (!post) return fail("That post no longer exists.");

  // Never trust the client's file name in a path. Keep a readable tail, put a
  // uuid in front so two uploads of "video.mp4" cannot collide.
  const safe = fileName.replace(/[^a-zA-Z0-9._-]/g, "-").slice(-80);
  const path = `${session.org.id}/${postId}/${crypto.randomUUID()}-${safe}`;

  const { data, error } = await supabase.storage
    .from("content-media")
    .createSignedUploadUrl(path);
  if (error) return fail(readable(error.message));

  return { ok: true, data: { path, token: data.token } };
}

/** Record an uploaded blob against its post. */
export async function recordAsset(input: {
  postId: string;
  path: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  sort: number;
}): Promise<Result> {
  const session = await requireSession();
  const supabase = await createClient();

  const { error } = await supabase.from("content_assets").insert({
    org_id: session.org.id,
    post_id: input.postId,
    storage_path: input.path,
    file_name: input.fileName,
    mime_type: input.mimeType,
    size_bytes: input.sizeBytes,
    sort: input.sort,
  });
  if (error) return fail(readable(error.message));

  // No revalidate: uploads happen from inside the open drawer, and revalidating
  // under an open layer remounts it. The planner refreshes when the drawer
  // closes instead.
  return { ok: true, data: undefined };
}

/** Remove one asset: the row first, then the blob (law 4). */
export async function removeAsset(assetId: string): Promise<Result> {
  const supabase = await createClient();

  // select() after delete returns what was actually removed, which is the
  // honest answer. RLS silently excludes another org's row.
  const { data, error } = await supabase
    .from("content_assets")
    .delete()
    .eq("id", assetId)
    .select("storage_path");
  if (error) return fail(readable(error.message));

  const path = data?.[0]?.storage_path;
  if (!path) return fail("That file was already gone.");

  const { error: storageError } = await supabase.storage
    .from("content-media")
    .remove([path]);
  if (storageError) {
    return fail(
      `The file is off the post, but storage did not release it: ${storageError.message}`,
    );
  }

  // No revalidate, for the same reason as recordAsset above.
  return { ok: true, data: undefined };
}

/* ---------------------------------------------------------------------------
 * LinkedIn, through Unipile (Pillar 5 phase B)
 *
 * The recruiter never handles a key. They walk through Unipile's hosted wizard
 * and their profile becomes an account under RecruiterGTM's single tenant, so
 * these actions deal in links and account ids, never credentials.
 * ------------------------------------------------------------------------- */

/**
 * Mint a hosted auth link and hand it back for the browser to visit.
 *
 * Returning the URL rather than redirecting from the action keeps the failure
 * readable: a redirect that throws mid-action shows a blank error page, while
 * this puts Unipile's own message in a toast.
 */
export async function startLinkedInConnect(
  reconnectAccountId?: string,
): Promise<Result<string>> {
  const session = await requireSession();

  if (!hasUnipile()) {
    return fail(
      "LinkedIn posting is not configured on this deployment yet, so there is nothing to connect to.",
    );
  }

  // Reconnecting somebody else's profile is not a thing an org member should be
  // able to start, so the row has to be visible to them and theirs or they have
  // to be an admin. RLS already limits the read to the org.
  if (reconnectAccountId) {
    const supabase = await createClient();
    const { data: existing } = await supabase
      .from("linkedin_accounts")
      .select("connected_by")
      .eq("unipile_account_id", reconnectAccountId)
      .maybeSingle();

    if (!existing) return fail("That account is not connected to this workspace.");
    if (
      existing.connected_by !== session.userId &&
      session.role === "member"
    ) {
      return fail("Only the person who connected that profile, or an admin, can reconnect it.");
    }
  }

  const origin =
    process.env.NEXT_PUBLIC_SITE_URL ??
    (await headers()).get("origin") ??
    "http://localhost:3000";

  try {
    const url = await createHostedAuthLink({
      orgId: session.org.id,
      userId: session.userId,
      origin: origin.replace(/\/+$/, ""),
      reconnectAccountId,
    });
    return { ok: true, data: url };
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : "Unipile could not be reached.",
    );
  }
}

/* ---------------------------------------------------------------------------
 * PLS-89. Connecting from inside the app.
 *
 * The hosted wizard above stays the default and the recommendation: LinkedIn
 * sees its own flow, and Pulse never touches a password. These exist because
 * the wizard means leaving the app, and because some profiles refuse the
 * hosted flow outright.
 *
 * There is no webhook on this path. The action gets the account id back on the
 * response, so it records the row itself, through the caller's own session so
 * RLS decides the org rather than a string we parsed.
 * ------------------------------------------------------------------------- */

export type ConnectStep =
  | { step: "connected"; name: string }
  | { step: "checkpoint"; accountId: string; checkpoint: string };

/**
 * Record a freshly connected account.
 *
 * Law 2: upsert on the unique index rather than check-then-insert. Connecting a
 * profile that is already here, which is exactly what a reconnect after an
 * expired session looks like, lands on the same row instead of a duplicate.
 */
async function recordAccount(accountId: string): Promise<Result<string>> {
  const session = await requireSession();
  const supabase = await createClient();

  // Ask Unipile who this is rather than making the user type a label. Not
  // fatal: the connection is real either way, and a blank name beats no row.
  let displayName = "";
  try {
    const account = await getAccount(accountId);
    displayName = account.name ?? "";
  } catch {
    displayName = "";
  }

  const { error } = await supabase.from("linkedin_accounts").upsert(
    {
      org_id: session.org.id,
      unipile_account_id: accountId,
      display_name: displayName,
      status: "connected",
      connected_by: session.userId,
      last_error: "",
    },
    { onConflict: "unipile_account_id" },
  );

  if (error) {
    // The profile IS connected on Unipile's side and is already being billed,
    // so say that rather than implying nothing happened.
    return fail(
      `LinkedIn accepted the sign in, but the profile could not be saved here: ${readable(
        error.message,
      )}. It is connected on Unipile as ${accountId}.`,
    );
  }

  revalidatePath("/settings/channels");
  return { ok: true, data: displayName || "That profile" };
}

/** Turn a Unipile connect result into either a done step or a code prompt. */
async function afterConnect(result: ConnectResult): Promise<Result<ConnectStep>> {
  if (result.status === "checkpoint") {
    return {
      ok: true,
      data: {
        step: "checkpoint",
        accountId: result.accountId,
        checkpoint: result.checkpoint,
      },
    };
  }
  const saved = await recordAccount(result.accountId);
  if (!saved.ok) return saved;
  return { ok: true, data: { step: "connected", name: saved.data } };
}

/** Sign in with a LinkedIn email and password. */
export async function connectLinkedInCredentials(
  username: string,
  password: string,
): Promise<Result<ConnectStep>> {
  await requireSession();

  if (!hasUnipile()) {
    return fail(
      "LinkedIn posting is not configured on this deployment yet, so there is nothing to connect to.",
    );
  }
  if (!username.trim() || !password) {
    return fail("Both the email and the password are needed.");
  }

  try {
    return await afterConnect(
      await connectWithCredentials({ username, password }),
    );
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : "Unipile could not be reached.",
    );
  }
}

/** Sign in with the `li_at` cookie from a browser already signed in. */
export async function connectLinkedInCookie(
  accessToken: string,
  userAgent: string,
): Promise<Result<ConnectStep>> {
  await requireSession();

  if (!hasUnipile()) {
    return fail(
      "LinkedIn posting is not configured on this deployment yet, so there is nothing to connect to.",
    );
  }
  if (!accessToken.trim()) {
    return fail("Paste the li_at cookie value first.");
  }

  try {
    return await afterConnect(
      await connectWithCookie({
        accessToken,
        userAgent: userAgent.trim() || undefined,
      }),
    );
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : "Unipile could not be reached.",
    );
  }
}

/**
 * Answer the code LinkedIn sent.
 *
 * LinkedIn can ask twice, an app approval and then an SMS code for instance, so
 * a checkpoint answer can itself return another checkpoint. The caller handles
 * that by staying on the code screen rather than assuming success.
 */
export async function submitLinkedInCheckpoint(
  accountId: string,
  code: string,
): Promise<Result<ConnectStep>> {
  await requireSession();

  if (!code.trim()) return fail("Enter the code LinkedIn sent you.");

  try {
    return await afterConnect(await solveCheckpoint({ accountId, code }));
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : "Unipile could not be reached.",
    );
  }
}

/** Ask LinkedIn to send the code again. */
export async function resendLinkedInCheckpoint(
  accountId: string,
): Promise<Result> {
  await requireSession();

  try {
    await resendCheckpoint(accountId);
    return { ok: true, data: undefined };
  } catch (error) {
    return fail(
      error instanceof Error
        ? error.message
        : "LinkedIn would not send another code.",
    );
  }
}

/**
 * Disconnect a profile.
 *
 * The row goes first and the release second, the same ordering as law 4: a row
 * pointing at an account Unipile no longer has is a screen that offers to post
 * from something that cannot post. The reverse failure leaves an account we are
 * still billed for, so if the release fails it is reported with the id rather
 * than swallowed. Unipile charges on the peak count in a 30 day window.
 */
export async function disconnectLinkedIn(accountId: string): Promise<Result> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("linkedin_accounts")
    .delete()
    .eq("unipile_account_id", accountId)
    .select("unipile_account_id");
  if (error) return fail(readable(error.message));

  // RLS returns an empty set rather than an error when the policy says no.
  if (!data || data.length === 0) {
    return fail(
      "That profile was not disconnected. Only the person who connected it, or an admin, can remove it.",
    );
  }

  revalidatePath("/settings/channels");

  try {
    await deleteAccount(accountId);
  } catch (releaseError) {
    return fail(
      `Removed from Pulse, but Unipile still holds ${accountId} and will keep billing for it: ${
        releaseError instanceof Error ? releaseError.message : "unknown error"
      }`,
    );
  }

  return { ok: true, data: undefined };
}

export async function saveIntegrationKey(
  provider: string,
  apiKey: string,
  label: string,
): Promise<Result> {
  if (!apiKey.trim()) return fail("Paste the key first.");

  const session = await requireSession();
  const supabase = await createClient();

  const { error } = await supabase.rpc("set_integration_key", {
    target_org: session.org.id,
    target_provider: provider,
    api_key: apiKey.trim(),
    key_label: label.trim(),
  });
  if (error) return fail(readable(error.message));

  // "layout" so the nested /settings/integrations screen refreshes too, not
  // just the /settings index.
  revalidatePath("/settings", "layout");
  return { ok: true, data: undefined };
}

export async function removeIntegrationKey(provider: string): Promise<Result> {
  const session = await requireSession();
  const supabase = await createClient();

  const { error } = await supabase.rpc("remove_integration_key", {
    target_org: session.org.id,
    target_provider: provider,
  });
  if (error) return fail(readable(error.message));

  revalidatePath("/settings", "layout");
  return { ok: true, data: undefined };
}

// ---------------------------------------------------------------------------
// The person / candidacy model. Each of these spans tables, so each is an RPC.
// ---------------------------------------------------------------------------

export async function moveCandidacy(
  candidacyId: string,
  stageId: string,
): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("move_candidacy", {
    candidacy: candidacyId,
    target_stage: stageId,
  });
  if (error) return fail(readable(error.message));

  revalidatePath("/pipeline", "layout");
  return { ok: true, data: undefined };
}

export async function bulkMoveCandidacies(
  candidacyIds: string[],
  stageId: string,
): Promise<Result<number>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("bulk_move_candidacies", {
    candidacy_ids: candidacyIds,
    target_stage: stageId,
  });
  if (error) return fail(readable(error.message));

  revalidatePath("/pipeline", "layout");
  // The RPC returns how many actually moved, which can be fewer than asked for.
  return { ok: true, data: (data as number) ?? 0 };
}

export async function addPersonToJob(input: {
  jobId: string;
  name: string;
  email?: string;
  phone?: string;
  title?: string;
  company?: string;
  linkedin?: string;
  source?: string;
}): Promise<Result<string>> {
  if (!input.name.trim()) return fail("Enter the candidate's name.");

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("add_person_to_job", {
    target_job: input.jobId,
    p_name: input.name.trim(),
    p_email: (input.email ?? "").trim().toLowerCase(),
    p_phone: input.phone ?? "",
    p_title: input.title ?? "",
    p_company: input.company ?? "",
    p_linkedin: input.linkedin ?? "",
    p_source: input.source ?? "Manual",
  });
  if (error) return fail(readable(error.message));

  revalidatePath("/pipeline", "layout");
  revalidatePath("/candidates");
  return { ok: true, data: data as string };
}

export async function addPersonNote(
  personId: string,
  body: string,
  jobId?: string,
): Promise<Result<string>> {
  if (!body.trim()) return fail("Write something first.");

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("add_person_note", {
    target_person: personId,
    note_body: body.trim(),
    target_job: jobId ?? null,
  });
  if (error) return fail(readable(error.message));

  revalidatePath("/pipeline", "layout");
  return { ok: true, data: data as string };
}

// Patch one profile field. Allow-listed here AND constrained by RLS, so a
// crafted request cannot reach a column the drawer does not expose.
const PERSON_FIELDS = new Set([
  "name", "email", "phone", "title", "company_name", "location",
  "linkedin_url", "salary_expectation", "source", "video_url",
  "last_contacted_at", "replied", "rating",
]);

export async function patchPerson(
  personId: string,
  field: string,
  value: string | boolean | number | null,
): Promise<Result> {
  if (!PERSON_FIELDS.has(field)) return fail("That field is not editable.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("people")
    .update({ [field]: value, updated_at: new Date().toISOString() })
    .eq("id", personId);
  if (error) return fail(readable(error.message));

  // No revalidate: these save on blur while the drawer is open, and
  // revalidating under an open layer remounts it and drops the caret.
  return { ok: true, data: undefined };
}

// Everyone at a stage becomes a shortlist. Idempotent on the same roster, so a
// double click cannot mint two public URLs to candidate PII.
export async function generateShortlist(input: {
  jobId: string;
  stageName?: string;
  title?: string;
  client?: string;
  preparedFor?: string;
}): Promise<Result<string>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("generate_shortlist", {
    target_job: input.jobId,
    stage_name: input.stageName ?? "Interview",
    list_title: input.title ?? null,
    client: input.client ?? "",
    prepared_for: input.preparedFor ?? "",
  });
  if (error) return fail(readable(error.message));

  revalidatePath("/pipeline", "layout");
  return { ok: true, data: data as string };
}

export async function revokeShortlist(id: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("revoke_shortlist", { list: id });
  if (error) return fail(readable(error.message));

  revalidatePath("/pipeline", "layout");
  return { ok: true, data: undefined };
}

// Rows first, then blobs. The RPC hands back the storage keys precisely so the
// order cannot be got wrong: an orphan blob is cheap, a dangling pointer is not.
export async function deletePeople(ids: string[]): Promise<Result<number>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("delete_people", {
    person_ids: ids,
  });
  if (error) return fail(readable(error.message));

  const row = Array.isArray(data) ? data[0] : data;
  const paths: string[] = row?.storage_paths ?? [];
  if (paths.length > 0) {
    await supabase.storage.from("candidate-files").remove(paths);
  }

  revalidatePath("/pipeline", "layout");
  revalidatePath("/candidates");
  return { ok: true, data: row?.removed ?? 0 };
}
