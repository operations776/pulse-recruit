import "server-only";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { dayKey } from "@/lib/time";
import type {
  ActivityRow,
  AssetRow,
  CandidateRow,
  ChatRow,
  ChatSurface,
  CompanyRow,
  CreditRow,
  DreamCompanyRow,
  JobRow,
  LinkedInAccountRow,
  MailboxRow,
  MembershipRow,
  NoteRow,
  PostAsset,
  PostRow,
  SequenceRow,
  SequenceStepRow,
  SignalRow,
  StageRow,
  BoardCard,
  CandidacyRow,
  PersonFileRow,
  PersonRow,
  ShortlistRow,
  StageEventRow,
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

/**
 * The planner: every post, plus signed URLs for the media on the ones the
 * calendar can actually show this month.
 *
 * Posts are low volume by design (the target is thirty a quarter), so the rows
 * come back in one query and both the calendar and the board render from the
 * same array. Signing is the part that does not scale, so it is scoped: a post
 * outside the visible month carries its media count and nothing else.
 */
export async function getPlanner(month: string) {
  const session = await requireSession();
  const supabase = await createClient();

  const [postsResult, assetsResult] = await Promise.all([
    supabase
      .from("content_posts")
      .select("*")
      .order("created_at", { ascending: false }),
    supabase.from("content_assets").select("*").order("sort"),
  ]);

  const posts = (postsResult.data ?? []) as PostRow[];
  const assets = (assetsResult.data ?? []) as AssetRow[];
  const tz = session.org.timezone;

  // Undated posts live in the backlog and are always on screen, so their media
  // is always worth signing.
  const visible = new Set(
    posts
      .filter(
        (p) =>
          !p.scheduled_for || dayKey(p.scheduled_for, tz).slice(0, 7) === month,
      )
      .map((p) => p.id),
  );

  const toSign = assets.filter((a) => visible.has(a.post_id));
  const signed = new Map<string, string>();
  if (toSign.length > 0) {
    const { data } = await supabase.storage
      .from("content-media")
      .createSignedUrls(
        toSign.map((a) => a.storage_path),
        60 * 60,
      );
    for (const entry of data ?? []) {
      if (entry.path && entry.signedUrl) signed.set(entry.path, entry.signedUrl);
    }
  }

  const byPost = new Map<string, PostAsset[]>();
  for (const asset of assets) {
    const list = byPost.get(asset.post_id) ?? [];
    list.push({ ...asset, url: signed.get(asset.storage_path) ?? null });
    byPost.set(asset.post_id, list);
  }

  return {
    posts,
    assets: Object.fromEntries(byPost) as Record<string, PostAsset[]>,
    timezone: tz,
  };
}

/** The LinkedIn profiles this org has connected through Unipile. */
export async function getLinkedInAccounts() {
  await requireSession();
  const supabase = await createClient();
  const { data } = await supabase
    .from("linkedin_accounts")
    .select("*")
    .neq("status", "disconnected")
    .order("connected_at", { ascending: true });
  return (data ?? []) as LinkedInAccountRow[];
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

// The four counts on the morning brief. Its own query rather than getReports,
// which still reads the pre-split `candidates` table and therefore misses
// anyone added since PLS-45. A tile that is quietly wrong is worse than no
// tile, and this one sits directly above an assistant claiming to read the
// same pipeline.
export async function getOpsTiles(coldAfterDays: number) {
  await requireSession();
  const supabase = await createClient();

  const coldBefore = new Date(
    Date.now() - coldAfterDays * 86_400_000,
  ).toISOString();

  const [live, cold, atRisk, openTasks] = await Promise.all([
    supabase
      .from("candidacies")
      .select("id", { count: "exact", head: true })
      .is("archived_at", null),
    supabase
      .from("candidacies")
      .select("id", { count: "exact", head: true })
      .is("archived_at", null)
      .lt("last_activity_at", coldBefore),
    supabase
      .from("jobs")
      .select("id", { count: "exact", head: true })
      .eq("state", "risk"),
    supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .is("done_at", null),
  ]);

  return {
    live: live.count ?? 0,
    cold: cold.count ?? 0,
    atRisk: atRisk.count ?? 0,
    openTasks: openTasks.count ?? 0,
  };
}

// ---------------------------------------------------------------------------
// The person / candidacy model. These supersede getBoard and getCandidates.
// ---------------------------------------------------------------------------

export async function getBoardV2(jobId: string) {
  const session = await requireSession();
  const supabase = await createClient();

  const [job, stages, cards] = await Promise.all([
    supabase.from("jobs").select("*").eq("id", jobId).maybeSingle(),
    supabase.from("stages").select("*").eq("job_id", jobId).order("position"),
    supabase
      .from("candidacies")
      .select("*, person:people(*)")
      .eq("job_id", jobId)
      .is("archived_at", null)
      .order("sort", { ascending: true })
      .order("created_at", { ascending: true }),
  ]);

  return {
    session,
    job: (job.data ?? null) as JobRow | null,
    stages: (stages.data ?? []) as StageRow[],
    cards: (cards.data ?? []) as unknown as BoardCard[],
  };
}

// The whole human: their profile, every role they are on, their notes, their
// files, and the stage history of each candidacy.
export async function getPerson(personId: string) {
  await requireSession();
  const supabase = await createClient();

  const [person, candidacies, notes, files] = await Promise.all([
    supabase.from("people").select("*").eq("id", personId).maybeSingle(),
    supabase
      .from("candidacies")
      .select("*, job:jobs(id, title, ref, state)")
      .eq("person_id", personId)
      .order("created_at", { ascending: false }),
    supabase
      .from("notes")
      .select("*")
      .eq("person_id", personId)
      .order("created_at", { ascending: false }),
    supabase
      .from("person_files")
      .select("*")
      .eq("person_id", personId)
      .order("created_at", { ascending: false }),
  ]);

  const ids = (candidacies.data ?? []).map((c) => c.id);
  const { data: events } = ids.length
    ? await supabase
        .from("stage_events")
        .select("*")
        .in("candidacy_id", ids)
        .order("created_at", { ascending: false })
    : { data: [] };

  return {
    person: (person.data ?? null) as PersonRow | null,
    candidacies: (candidacies.data ?? []) as unknown as (CandidacyRow & {
      job: { id: string; title: string; ref: string; state: string } | null;
    })[],
    notes: (notes.data ?? []) as NoteRow[],
    files: (files.data ?? []) as PersonFileRow[],
    events: (events ?? []) as StageEventRow[],
  };
}

export async function getPeople() {
  await requireSession();
  const supabase = await createClient();

  const [people, candidacies, jobs, stages] = await Promise.all([
    supabase.from("people").select("*").order("created_at", { ascending: false }),
    supabase.from("candidacies").select("*").is("archived_at", null),
    supabase.from("jobs").select("*"),
    supabase.from("stages").select("*"),
  ]);

  return {
    people: (people.data ?? []) as PersonRow[],
    candidacies: (candidacies.data ?? []) as CandidacyRow[],
    jobs: (jobs.data ?? []) as JobRow[],
    stages: (stages.data ?? []) as StageRow[],
  };
}

export async function getShortlists(jobId?: string) {
  await requireSession();
  const supabase = await createClient();

  let query = supabase
    .from("shortlists")
    .select("*")
    .is("revoked_at", null)
    .order("created_at", { ascending: false });
  if (jobId) query = query.eq("job_id", jobId);

  const { data } = await query;
  return (data ?? []) as ShortlistRow[];
}

// Signed URLs are minted per request and never stored. The retainer dashboard
// bakes them into saved HTML, so every published shortlist's images 404 an hour
// later. A short TTL is safe precisely because nothing persists it.
export async function signPaths(paths: string[], seconds = 900) {
  await requireSession();
  if (paths.length === 0) return {} as Record<string, string>;

  const supabase = await createClient();
  const { data } = await supabase.storage
    .from("candidate-files")
    .createSignedUrls(paths, seconds);

  const out: Record<string, string> = {};
  for (const row of data ?? []) {
    if (row.path && row.signedUrl) out[row.path] = row.signedUrl;
  }
  return out;
}
