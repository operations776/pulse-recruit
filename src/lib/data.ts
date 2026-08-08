import "server-only";
import { requireSession } from "@/lib/auth";
import { loadBDAgentMemories } from "@/lib/server/ai/bd-memory";
import { createClient } from "@/lib/supabase/server";
import { allShapes } from "@/lib/shapes";
import { BD_FEEDBACK_TITLE } from "@/lib/supabase/types";
import { dayKey } from "@/lib/time";
import type {
  ActivityRow,
  BDCommitmentRow,
  ChatConversationRow,
  BDFeedbackRating,
  AssetRow,
  CandidateRow,
  ContentShapeRow,
  PersonaLessonRow,
  PersonaRow,
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
  NotificationRow,
  OrgMember,
  PersonFieldDefRow,
  PostAsset,
  PostRow,
  TaskAssigneeRow,
  TaskCommentRow,
  TaskWatcherRow,
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

// A uuid no row will ever carry, used to express "match nothing" without
// branching a query builder into two incompatible shapes.
const NO_ROW = "00000000-0000-0000-0000-000000000000";

// Every read goes through here. Each function resolves the session itself, so a
// screen cannot forget to scope by org, and RLS is the backstop if one does.
// A missing policy shows up as empty data rather than another org's rows.

export async function getWorkspace() {
  const session = await requireSession();
  const supabase = await createClient();

  const [jobs, credits, members] = await Promise.all([
    // ref as the tiebreak: seeded rows share one created_at, and without a
    // total order jobs[0] is decided by heap order, which any UPDATE moves.
    // The pipeline index redirects to jobs[0], so this was a different first
    // board depending on which row was touched last.
    supabase
      .from("jobs")
      .select("*")
      .order("created_at", { ascending: true })
      .order("ref", { ascending: true }),
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

/**
 * The id of the first role, and nothing else.
 *
 * The pipeline index only needs this one value to redirect. Calling
 * getWorkspace for it fetched every job, the credit ledger and the whole
 * membership list, then discarded all of it, on the route the product opens on.
 */
export async function getFirstJobId(): Promise<string | null> {
  await requireSession();
  const supabase = await createClient();

  const { data } = await supabase
    .from("jobs")
    .select("id")
    // Same total order as getWorkspace: seeded rows share a created_at, so
    // without the ref tiebreak "first" is decided by heap order and any UPDATE
    // moves it.
    .order("created_at", { ascending: true })
    .order("ref", { ascending: true })
    .limit(1)
    .maybeSingle();

  return data?.id ?? null;
}

export async function getBoard(jobId: string) {
  const session = await requireSession();
  const supabase = await createClient();

  const [job, stages, candidates, fieldDefs] = await Promise.all([
    supabase.from("jobs").select("*").eq("id", jobId).maybeSingle(),
    supabase.from("stages").select("*").eq("job_id", jobId).order("position"),
    supabase
      .from("candidates")
      .select("*")
      .eq("job_id", jobId)
      .is("archived_at", null)
      .order("created_at", { ascending: true }),
    supabase.from("person_field_defs").select("*").order("sort"),
  ]);

  return {
    session,
    job: job.data as JobRow | null,
    stages: (stages.data ?? []) as StageRow[],
    candidates: (candidates.data ?? []) as CandidateRow[],
    fieldDefs: (fieldDefs.data ?? []) as PersonFieldDefRow[],
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
      // Same tie as getBDWorkspace: begin_ask writes the question and the
      // answer with one created_at. chat_role is an enum and sorts by
      // definition order ('user' = 1, 'assistant' = 2), so on this
      // oldest-first query with no reverse, ascending role is what puts the
      // question ahead of its answer.
      .order("created_at", { ascending: true })
      .order("role", { ascending: true }),
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

/**
 * Everything the BD Strategist needs on first paint.
 *
 * A MARKET transcript used to grow forever, which made the agent slower the
 * more faithfully somebody used it. The strategist renders a useful recent
 * window and reads visible durable context separately, so old conversation is
 * not mistaken for memory and is not shipped on every visit.
 */
export async function getBDWorkspace(
  conversationId?: string,
  /** True when the caller wants a blank slate, not the most recent thread. */
  startFresh = false,
) {
  const session = await requireSession();
  const supabase = await createClient();

  // Which thread to open. An explicit id wins; otherwise the most recently
  // active one, which is what a recruiter coming back to the screen expects.
  // Null means the workspace is empty and the composer starts a first thread.
  const { data: threadRows } = await supabase
    .from("chat_conversations")
    .select("*")
    .eq("surface", "market")
    .order("last_message_at", { ascending: false })
    .limit(40);

  const conversations = (threadRows ?? []) as ChatConversationRow[];
  // Only an explicitly requested thread opens. This used to fall back to the
  // most recent one, which meant /market re-opened last week's transcript and
  // the briefing pushed Mara's whole stage, the greeting, the play, the
  // metrics and the signals, off the top of the screen. Landing on the module
  // is landing on the stage; a conversation is something you choose to open.
  const active = startFresh
    ? null
    : (conversations.find((c) => c.id === conversationId) ?? null);

  const [messages, credits, memories] = await Promise.all([
    // Scoped to the open thread. This is what the 60-row cap was standing in
    // for: a transcript that grew forever had no natural boundary to read to.
    (active
      ? supabase
          .from("chat_messages")
          .select("*")
          .eq("conversation_id", active.id)
      : supabase.from("chat_messages").select("*").eq("id", NO_ROW)
    )
      .eq("surface", "market")
      // `role` is the tiebreak, and it is load-bearing. begin_ask inserts the
      // question and the answer in ONE transaction, so both rows carry an
      // identical created_at and ordering by time alone is a tie Postgres
      // resolves by heap order. On the deployed build that rendered answers
      // above the questions that produced them.
      //
      // chat_role is an ENUM, so it sorts by DEFINITION order ('user' = 1,
      // 'assistant' = 2), not alphabetically. Checking this with `role::text`
      // gives the opposite answer and a fix that changes nothing. This query
      // is newest-first and the result is reversed below, so descending role
      // here displays as user then assistant: the order they happened in.
      .order("created_at", { ascending: false })
      .order("role", { ascending: false })
      .limit(200),
    supabase.from("credit_ledger").select("*").maybeSingle(),
    loadBDAgentMemories(supabase, session.org.id, session.userId),
  ]);

  const stalledBefore = Date.now() - 10 * 60_000;
  const rows = ((messages.data ?? []) as ChatRow[])
    .reverse()
    .map((message) =>
      message.status === "running" &&
      new Date(message.created_at).getTime() < stalledBefore
        ? {
            ...message,
            status: "failed" as const,
            error:
              message.error ??
              "This run stopped before it finished. The credits it reserved have been given back.",
          }
        : message,
    );

  // Which answers this recruiter has already rated, so the controls under a
  // briefing show the state rather than inviting the same feedback twice.
  const feedbackByAnswer: Record<string, BDFeedbackRating> = {};
  for (const memory of memories) {
    if (memory.source !== "feedback" || !memory.answer_id) continue;
    feedbackByAnswer[memory.answer_id] =
      memory.title === BD_FEEDBACK_TITLE.useful ? "useful" : "off_target";
  }

  return {
    session,
    messages: rows,
    credits: (credits.data ?? null) as CreditRow | null,
    memories,
    feedbackByAnswer,
    conversations,
    activeConversationId: active?.id ?? null,
  };
}

/**
 * Everything Mara's screen needs beyond the transcript (PLS-112).
 *
 * The metrics are computed from rows that already exist rather than stored:
 * "accounts on patch" is the Dream 100, "roles live" is open jobs, "clients
 * gone quiet" is companies with nothing on their timeline for 90 days. BD
 * time has no source at all, so the caller marks that tile pending instead of
 * inventing a number.
 */
export async function getMaraBoard() {
  const session = await requireSession();
  const supabase = await createClient();

  const ninetyDaysAgo = new Date(Date.now() - 90 * 86_400_000).toISOString();
  const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();

  // Already answered today. "Still chasing" leaves the commitment open on
  // purpose, so it stays in the ledger, but re-asking about it the same
  // evening is the product not listening. The unique index makes the write
  // idempotent; this makes the question stop.
  const askedToday = new Date().toISOString().slice(0, 10);

  const [
    commitments,
    dream,
    openJobs,
    newDream,
    signals,
    quiet,
    debriefedToday,
  ] = await Promise.all([
    supabase
      .from("bd_commitments")
      .select("*")
      .eq("status", "open")
      // Oldest first: the promise you have been avoiding longest is the one
      // that needs saying out loud.
      .order("said_at", { ascending: true })
      .limit(8),
    supabase
      .from("dream_companies")
      .select("id", { count: "exact", head: true }),
    supabase
      .from("jobs")
      .select("id", { count: "exact", head: true })
      .eq("state", "open"),
    supabase
      .from("dream_companies")
      .select("id", { count: "exact", head: true })
      .gte("added_at", weekAgo),
    supabase
      .from("signals")
      .select("*")
      .is("dismissed_at", null)
      .gte("detected_at", sevenDaysAgo)
      .order("detected_at", { ascending: false })
      .limit(6),
    // Clients with nothing recent on them. `last_signal_at` is the only
    // activity stamp the Dream 100 carries, so quiet means never seen or not
    // seen in ninety days.
    supabase
      .from("dream_companies")
      .select("id", { count: "exact", head: true })
      .or(`last_signal_at.is.null,last_signal_at.lt.${ninetyDaysAgo}`),
    supabase
      .from("bd_debriefs")
      .select("commitment_id")
      .eq("asked_on", askedToday),
  ]);

  // Signals carry a dream_company_id, not a name, and the card and the play
  // both need the name. One extra query keyed by the ids actually returned,
  // rather than a join that would fetch the whole Dream 100 to label six rows.
  const signalRows = (signals.data ?? []) as SignalRow[];
  let namesById = new Map<string, string>();
  if (signalRows.length > 0) {
    const { data: companyRows } = await supabase
      .from("dream_companies")
      .select("id,name")
      .in("id", [...new Set(signalRows.map((row) => row.dream_company_id))]);
    namesById = new Map(
      (companyRows ?? []).map((row) => [row.id as string, row.name as string]),
    );
  }

  const withNames = signalRows.map((row) => ({
    ...row,
    // A signal whose company was deleted still describes something real, so it
    // renders with an honest placeholder rather than being dropped.
    companyName: namesById.get(row.dream_company_id) ?? "an account on your patch",
  }));

  const answeredIds = new Set(
    (debriefedToday.data ?? []).map((row) => row.commitment_id as string),
  );

  return {
    session,
    commitments: (commitments.data ?? []) as BDCommitmentRow[],
    /** Open, and not already answered this evening. */
    debriefCandidates: ((commitments.data ?? []) as BDCommitmentRow[]).filter(
      (row) => !answeredIds.has(row.id),
    ),
    signals: withNames,
    counts: {
      patch: dream.count ?? 0,
      patchNew: newDream.count ?? 0,
      rolesLive: openJobs.count ?? 0,
      quiet: quiet.count ?? 0,
    },
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

/**
 * Everything the tasks screen needs in one shot: the rows, who each one is
 * assigned to, and the member directory to resolve ids into names.
 */
/**
 * Everything the tasks workspace renders, in two round trips.
 *
 * Two rather than one because the comment counts and the open stream are both
 * scoped to the tasks that came back, and asking for every comment row in the
 * workspace to count a handful of them is the shape of query that is fine on a
 * demo and expensive on a real agency. The first hop is one indexed read; the
 * second is six reads in parallel.
 *
 * Completed tasks are capped at the last 30 days, which is what the completed
 * list promises on screen. Older completions are a search problem, not a list
 * problem, and loading a year of them to render ten is how a list gets slow.
 */
export async function getTaskWorkspace(selectedTaskId?: string) {
  const session = await requireSession();
  const supabase = await createClient();

  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();

  const { data: taskData } = await supabase
    .from("tasks")
    .select("*")
    .or(`done_at.is.null,done_at.gte.${since}`)
    .order("due", { ascending: true, nullsFirst: false });

  const tasks = (taskData ?? []) as TaskRow[];
  const ids = tasks.map((t) => t.id);

  const [assignees, watchers, members, counts, candidates, companies, stream] =
    await Promise.all([
      supabase.from("task_assignees").select("*"),
      supabase.from("task_watchers").select("*"),
      supabase.rpc("org_members", { target_org: session.org.id }),
      ids.length
        ? supabase
            .from("task_comments")
            .select("task_id, kind, deleted_at")
            .in("task_id", ids)
        : Promise.resolve({ data: [] as CommentCount[] }),
      supabase.from("candidates").select("id, name").is("archived_at", null),
      supabase.from("companies").select("id, name, type"),
      // The panel's stream. Oldest first: this is a record, not a chat, and
      // people read it top to bottom when they pick a task up.
      //
      // Ordered by `seq`, never by created_at. create_task writes the creation
      // entry and the assignment entry in one transaction, now() is the
      // transaction start time, so both carry an identical stamp and ordering
      // by it is a tie Postgres settles by heap order. That is how the BD
      // transcript ended up rendering every answer above its own question.
      selectedTaskId
        ? supabase
            .from("task_comments")
            .select("*")
            .eq("task_id", selectedTaskId)
            .order("seq", { ascending: true })
        : Promise.resolve({ data: [] as TaskCommentRow[] }),
    ]);

  const assigneesByTask = groupUsers(
    (assignees.data ?? []) as TaskAssigneeRow[],
  );
  const watchersByTask = groupUsers((watchers.data ?? []) as TaskWatcherRow[]);

  // "2 NOTES" on a row counts what a person wrote. System entries are the
  // audit trail and every task has at least one, so counting them would print
  // "1 NOTE" on every row in the product and mean nothing.
  const noteCounts: Record<string, number> = {};
  for (const row of (counts.data ?? []) as CommentCount[]) {
    if (row.kind !== "comment" || row.deleted_at) continue;
    noteCounts[row.task_id] = (noteCounts[row.task_id] ?? 0) + 1;
  }

  // One directory for both jobs the quick add has: resolving "Rylee Thiel" in
  // a typed sentence, and printing "CLIENT Halden Group" on a row.
  const links: TaskLink[] = [
    ...((candidates.data ?? []) as { id: string; name: string }[]).map((c) => ({
      id: c.id,
      name: c.name,
      kind: "candidate" as const,
      label: "Candidate",
    })),
    ...((companies.data ?? []) as { id: string; name: string; type: string }[]).map(
      (c) => ({
        id: c.id,
        name: c.name,
        kind: "company" as const,
        label: c.type === "client" ? "Client" : "Company",
      }),
    ),
  ];

  return {
    session,
    tz: session.org.timezone,
    tasks,
    assigneesByTask,
    watchersByTask,
    members: directory(members.data, session),
    noteCounts,
    links,
    activity: (stream.data ?? []) as TaskCommentRow[],
  };
}

/**
 * The team directory, with the caller guaranteed to be in it.
 *
 * `org_members` is `security definer` and gated on `is_org_member`, which reads
 * `auth.uid()`. Measured against the live database: it returns the right rows
 * on every call WITH a session and zero rows WITHOUT one. It is not flaky.
 *
 * The bug was here. Every caller wrote `members.data ?? []`, so a request that
 * lost its session mid-render, or an RPC that errored, silently became "this
 * workspace has no people in it". The tasks screen then drew an avatar reading
 * "T" for Teammate and an empty By person rail, while the light-mode capture of
 * the same route and the same data drew the real name. Two screenshots
 * disagreeing is what surfaced it; nothing in the code said a word.
 *
 * That is the silent-partial-success class CLAUDE.md lists as a known bug not
 * to reintroduce, and this was a live instance of it.
 *
 * `requireSession` has already resolved the caller by the time this runs, and a
 * caller is always a member of their own org. So an empty directory is
 * impossible in a healthy request, and the caller's own row is a fact we
 * already hold rather than a fallback we invented. Reconstructing it keeps the
 * assignee picker and every avatar working, and the console line is what says
 * the read actually failed.
 */
function directory(
  rows: unknown,
  session: { userId: string; email: string; role: MembershipRow["role"] },
): OrgMember[] {
  const members = (rows ?? []) as OrgMember[];
  if (members.length > 0) return members;

  console.error(
    "org_members returned no rows for a signed-in caller. The directory is " +
      "being reconstructed from the session, so the assignee picker will show " +
      "only the current user until the next successful read.",
  );

  return [
    {
      user_id: session.userId,
      email: session.email,
      // Same shape org_members derives when a user has no full_name set.
      display_name: session.email.split("@")[0],
      role: session.role,
    },
  ];
}

export type TaskLink = {
  id: string;
  name: string;
  kind: "candidate" | "company";
  /** What the chip prints: Candidate, Client, or Company. */
  label: string;
};

/** The three columns the note count needs. Nothing else is read. */
type CommentCount = Pick<TaskCommentRow, "task_id" | "kind" | "deleted_at">;

function groupUsers(
  rows: { task_id: string; user_id: string }[],
): Record<string, string[]> {
  const byTask = new Map<string, string[]>();
  for (const row of rows) {
    const list = byTask.get(row.task_id) ?? [];
    list.push(row.user_id);
    byTask.set(row.task_id, list);
  }
  return Object.fromEntries(byTask);
}

/** The caller's unread notifications, newest first, plus the total unread. */
export async function getNotifications() {
  await requireSession();
  const supabase = await createClient();
  const { data } = await supabase
    .from("notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(30);
  return (data ?? []) as NotificationRow[];
}

/**
 * Every org this user belongs to, for the workspace chip.
 *
 * RLS on `orgs` already limits this to the caller's own memberships, so the
 * query needs no user filter of its own: a user who somehow asked for another
 * agency's org would get an empty set rather than a name.
 */
export async function getMyOrgs(): Promise<{ id: string; name: string }[]> {
  await requireSession();
  const supabase = await createClient();
  const { data } = await supabase
    .from("orgs")
    .select("id, name")
    .order("created_at", { ascending: true });
  return (data ?? []) as { id: string; name: string }[];
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

  const [
    postsResult,
    assetsResult,
    membersResult,
    shapesResult,
    personaResult,
    lessonsResult,
    channelResult,
  ] = await Promise.all([
      supabase
        .from("content_posts")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase.from("content_assets").select("*").order("sort"),
      supabase.rpc("org_members", { target_org: session.org.id }),
      supabase.from("content_shapes").select("*").order("sort"),
      // The caller's own persona. RLS lets a member read a teammate's row, but
      // the planner only ever needs yours: it decides whether to offer
      // generation or the intake.
      supabase
        .from("content_personas")
        .select("*")
        .eq("user_id", session.userId)
        .maybeSingle(),
      // Count only. The planner shows the number in the stat strip and links
      // to the persona screen for the detail, so pulling the rows here would
      // ship a payload nothing on this page renders.
      supabase
        .from("persona_lessons")
        .select("id", { count: "exact", head: true })
        .is("applied_at", null),
      // Whether a date on the calendar actually means anything. Head count
      // only: the planner needs the fact, not the profile.
      supabase
        .from("linkedin_accounts")
        .select("id", { count: "exact", head: true })
        .eq("status", "connected"),
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
    meId: session.userId,
    members: directory(membersResult.data, session),
    shapes: allShapes((shapesResult.data ?? []) as ContentShapeRow[]),
    persona: (personaResult.data ?? null) as PersonaRow | null,
    pendingLessons: lessonsResult.count ?? 0,
    canPublish: (channelResult.count ?? 0) > 0,
  };
}

/** The caller's persona, plus whatever it has learned and not yet applied. */
export async function getPersona() {
  const session = await requireSession();
  const supabase = await createClient();

  const { data: persona } = await supabase
    .from("content_personas")
    .select("*")
    .eq("user_id", session.userId)
    .maybeSingle();

  if (!persona) return { persona: null, lessons: [] as PersonaLessonRow[] };

  const { data: lessons } = await supabase
    .from("persona_lessons")
    .select("*")
    .eq("persona_id", (persona as PersonaRow).id)
    .is("applied_at", null)
    .order("created_at", { ascending: false });

  return {
    persona: persona as PersonaRow,
    lessons: (lessons ?? []) as PersonaLessonRow[],
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

// getOpsTiles lived here and counted live candidacies, cold candidacies, roles
// at risk and open tasks for the morning brief's four tiles. PLS-133 removed
// that screen and it had no other caller, so the query went with it rather
// than staying as an export nothing reaches. It is in the history if the
// counts are ever wanted on the task list instead.

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
