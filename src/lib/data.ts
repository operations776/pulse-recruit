import "server-only";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type {
  ActivityRow,
  CandidateRow,
  ChatRow,
  ChatSurface,
  CompanyRow,
  CreditRow,
  DreamCompanyRow,
  JobRow,
  MailboxRow,
  MembershipRow,
  NoteRow,
  PostRow,
  SequenceRow,
  SequenceStepRow,
  SignalRow,
  StageRow,
  TaskRow,
} from "@/lib/supabase/types";

// Every read goes through here. Each function resolves the session itself, so a
// screen cannot forget to scope by org, and RLS is the backstop if one does.
// A missing policy shows up as empty data rather than another org's rows.

export async function getWorkspace() {
  const session = await requireSession();
  const supabase = await createClient();

  const [jobs, credits, members] = await Promise.all([
    supabase.from("jobs").select("*").order("created_at", { ascending: true }),
    supabase.from("credit_ledger").select("*").maybeSingle(),
    supabase.from("org_memberships").select("*"),
  ]);

  return {
    session,
    jobs: (jobs.data ?? []) as JobRow[],
    credits: (credits.data ?? null) as CreditRow | null,
    members: (members.data ?? []) as MembershipRow[],
  };
}

export async function getBoard(jobId: string) {
  const session = await requireSession();
  const supabase = await createClient();

  const [job, stages, candidates] = await Promise.all([
    supabase.from("jobs").select("*").eq("id", jobId).maybeSingle(),
    supabase.from("stages").select("*").eq("job_id", jobId).order("position"),
    supabase
      .from("candidates")
      .select("*")
      .eq("job_id", jobId)
      .is("archived_at", null)
      .order("created_at", { ascending: true }),
  ]);

  return {
    session,
    job: job.data as JobRow | null,
    stages: (stages.data ?? []) as StageRow[],
    candidates: (candidates.data ?? []) as CandidateRow[],
  };
}

export async function getCandidates() {
  await requireSession();
  const supabase = await createClient();

  const [candidates, stages, jobs] = await Promise.all([
    supabase
      .from("candidates")
      .select("*")
      .is("archived_at", null)
      .order("last_activity_at", { ascending: false }),
    supabase.from("stages").select("*"),
    supabase.from("jobs").select("*"),
  ]);

  return {
    candidates: (candidates.data ?? []) as CandidateRow[],
    stages: (stages.data ?? []) as StageRow[],
    jobs: (jobs.data ?? []) as JobRow[],
  };
}

export async function getCandidateDetail(candidateId: string) {
  await requireSession();
  const supabase = await createClient();

  const [notes, activity] = await Promise.all([
    supabase
      .from("notes")
      .select("*")
      .eq("candidate_id", candidateId)
      .order("created_at", { ascending: false }),
    supabase
      .from("activity_events")
      .select("*")
      .eq("candidate_id", candidateId)
      .order("created_at", { ascending: false }),
  ]);

  return {
    notes: (notes.data ?? []) as NoteRow[],
    activity: (activity.data ?? []) as ActivityRow[],
  };
}

export async function getCompanies() {
  await requireSession();
  const supabase = await createClient();
  const { data } = await supabase
    .from("companies")
    .select("*")
    .order("name", { ascending: true });
  return (data ?? []) as CompanyRow[];
}

export async function getSignals() {
  await requireSession();
  const supabase = await createClient();

  const [signals, dream] = await Promise.all([
    supabase
      .from("signals")
      .select("*")
      .is("dismissed_at", null)
      .order("detected_at", { ascending: false }),
    supabase
      .from("dream_companies")
      .select("*")
      .order("tier", { ascending: true }),
  ]);

  return {
    signals: (signals.data ?? []) as SignalRow[],
    dreamCompanies: (dream.data ?? []) as DreamCompanyRow[],
  };
}

export async function getChat(surface: ChatSurface) {
  const session = await requireSession();
  const supabase = await createClient();

  const [messages, credits] = await Promise.all([
    supabase
      .from("chat_messages")
      .select("*")
      .eq("surface", surface)
      .order("created_at", { ascending: true }),
    supabase.from("credit_ledger").select("*").maybeSingle(),
  ]);

  // A run whose process died leaves a row saying `running` until the next ask
  // sweeps it. Presenting it as still working would be a lie, so it reads as
  // failed here. The database is corrected by `sweep_stalled_asks`, not by a
  // write during a render.
  const stalledBefore = Date.now() - 10 * 60_000;
  const rows = ((messages.data ?? []) as ChatRow[]).map((m) =>
    m.status === "running" && new Date(m.created_at).getTime() < stalledBefore
      ? {
          ...m,
          status: "failed" as const,
          error:
            m.error ??
            "This run stopped before it finished. The credits it reserved have been given back.",
        }
      : m,
  );

  return {
    session,
    messages: rows,
    credits: (credits.data ?? null) as CreditRow | null,
  };
}

export async function getTasks() {
  await requireSession();
  const supabase = await createClient();
  const { data } = await supabase
    .from("tasks")
    .select("*")
    .order("due", { ascending: true, nullsFirst: false });
  return (data ?? []) as TaskRow[];
}

export async function getSequences() {
  await requireSession();
  const supabase = await createClient();

  const [sequences, steps, mailboxes, links] = await Promise.all([
    supabase.from("sequences").select("*").order("created_at", { ascending: false }),
    supabase.from("sequence_steps").select("*").order("position"),
    supabase.from("mailboxes").select("*").order("created_at"),
    supabase.from("sequence_mailboxes").select("*"),
  ]);

  return {
    sequences: (sequences.data ?? []) as SequenceRow[],
    steps: (steps.data ?? []) as SequenceStepRow[],
    mailboxes: (mailboxes.data ?? []) as MailboxRow[],
    links: (links.data ?? []) as { sequence_id: string; mailbox_id: string }[],
  };
}

export async function getMailboxes() {
  await requireSession();
  const supabase = await createClient();
  const { data } = await supabase
    .from("mailboxes")
    .select("*")
    .order("created_at", { ascending: true });
  return (data ?? []) as MailboxRow[];
}

export async function getPosts() {
  await requireSession();
  const supabase = await createClient();
  const { data } = await supabase
    .from("content_posts")
    .select("*")
    .order("created_at", { ascending: false });
  return (data ?? []) as PostRow[];
}

export async function getIntegrations() {
  await requireSession();
  const supabase = await createClient();
  // secret_id is deliberately not selected. Nothing in the app needs it, and a
  // column you never read is a column you cannot leak.
  const { data } = await supabase
    .from("integrations")
    .select("id, org_id, provider, label, status, last_four, last_verified_at, last_error, updated_at")
    .order("provider", { ascending: true });
  return data ?? [];
}

export async function getReports() {
  await requireSession();
  const supabase = await createClient();

  const [candidates, jobs, stages] = await Promise.all([
    supabase.from("candidates").select("*").is("archived_at", null),
    supabase.from("jobs").select("*"),
    supabase.from("stages").select("*"),
  ]);

  return {
    candidates: (candidates.data ?? []) as CandidateRow[],
    jobs: (jobs.data ?? []) as JobRow[],
    stages: (stages.data ?? []) as StageRow[],
  };
}
