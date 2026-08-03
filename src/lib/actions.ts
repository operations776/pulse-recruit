"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type {
  ChatSurface,
  ContentSkill,
  PostStatus,
  SequenceStatus,
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

export async function toggleTask(
  taskId: string,
  done: boolean,
): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("tasks")
    .update({ done_at: done ? new Date().toISOString() : null })
    .eq("id", taskId);
  if (error) return fail(readable(error.message));

  revalidatePath("/ops/tasks");
  return { ok: true, data: undefined };
}

export async function createTask(
  title: string,
  detail: string,
): Promise<Result> {
  if (!title.trim()) return fail("Give the task a title.");

  const session = await requireSession();
  const supabase = await createClient();

  // next_ref has EXECUTE revoked from client roles on purpose, so ref
  // allocation happens inside the RPC rather than as a separate call.
  const { error } = await supabase.rpc("create_task", {
    target_org: session.org.id,
    task_title: title.trim(),
    task_detail: detail.trim(),
  });
  if (error) return fail(readable(error.message));

  revalidatePath("/ops/tasks");
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

export async function createPost(
  skill: ContentSkill,
  hook: string,
): Promise<Result> {
  if (!hook.trim()) return fail("Write the hook first.");

  const session = await requireSession();
  const supabase = await createClient();

  const { error } = await supabase.rpc("create_post", {
    target_org: session.org.id,
    post_skill: skill,
    post_hook: hook.trim(),
  });
  if (error) return fail(readable(error.message));

  revalidatePath("/content");
  return { ok: true, data: undefined };
}

export async function setPostStatus(
  postId: string,
  status: PostStatus,
): Promise<Result> {
  const supabase = await createClient();
  const patch: { status: PostStatus; scheduled_for?: string } = { status };
  if (status === "scheduled") {
    patch.scheduled_for = new Date(Date.now() + 86_400_000).toISOString();
  }
  const { error } = await supabase
    .from("content_posts")
    .update(patch)
    .eq("id", postId);
  if (error) return fail(readable(error.message));

  revalidatePath("/content");
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
