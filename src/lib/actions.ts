"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { requireSession } from "@/lib/auth";
import {
  createHostedAuthLink,
  deleteAccount,
  hasUnipile,
} from "@/lib/server/unipile";
import { createClient } from "@/lib/supabase/server";
import type {
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

export async function setPostStatus(
  postId: string,
  status: PostStatus,
): Promise<Result> {
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

  const { error } = await supabase
    .from("content_posts")
    .update(patch)
    .eq("id", postId);
  if (error) return fail(readable(error.message));

  revalidatePath("/content");
  return { ok: true, data: undefined };
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

  const status: PostStatus =
    existing.status === "published"
      ? "published"
      : when
        ? "scheduled"
        : existing.body.trim()
          ? "drafted"
          : "idea";

  const { error } = await supabase
    .from("content_posts")
    .update({ scheduled_for: when, status })
    .eq("id", postId);
  if (error) return fail(readable(error.message));

  revalidatePath("/content");
  return { ok: true, data: undefined };
}

/** Edit the words. Single table, so no RPC is owed. */
export async function updatePost(
  postId: string,
  patch: { hook?: string; body?: string; skill?: ContentSkill },
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

  // No revalidate. This is called from an open drawer, and revalidating under
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
