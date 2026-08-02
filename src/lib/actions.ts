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

export async function ask(
  surface: ChatSurface,
  question: string,
): Promise<Result<{ answered: boolean }>> {
  if (!question.trim()) return fail("Type a question first.");

  const session = await requireSession();
  const supabase = await createClient();

  // No research provider is connected yet, so the answer says so rather than
  // inventing one. When Exa lands, this is the only place that changes.
  const cost = surface === "market" ? 12 : 0;
  const body =
    surface === "market"
      ? "Live market research is not connected yet. Once a research provider is added in Settings, this answer will be built from job boards, funding news and LinkedIn, and every source will be listed below it."
      : "The ops manager is not connected to a model yet. Once it is, this answer will be built only from your own pipeline, never from the open web.";
  const sources =
    surface === "market"
      ? [{ label: "Pending", detail: "No research provider connected" }]
      : [{ label: "Pipeline", detail: "Reads your own records only" }];

  const { data, error } = await supabase.rpc("ask", {
    target_org: session.org.id,
    target_surface: surface,
    question: question.trim(),
    answer_body: body,
    answer_sources: sources,
    cost,
  });
  if (error) return fail(readable(error.message));

  revalidatePath(surface === "market" ? "/market" : "/ops");
  // null means the weekly allowance is spent. Say so plainly.
  return { ok: true, data: { answered: data !== null } };
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
