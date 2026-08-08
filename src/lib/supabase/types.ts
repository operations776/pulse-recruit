// Database types.
//
// Hand-maintained against the migrations in supabase/migrations. Regenerate the
// full file with the Supabase CLI once it is wired up:
//   npx supabase gen types typescript --project-id zlnctqlabowdaahnvheo
// Until then, treat a mismatch between this file and a migration as a bug in
// this file. Drift between hand-written types and the schema is exactly the
// class of error the RPC boundary exists to prevent, so keep them in step.

export type OrgRole = "owner" | "admin" | "member";
export type CompanyType = "client" | "prospect";
export type JobState = "open" | "risk" | "closed";
export type ActivityKind =
  | "created"
  | "stage_changed"
  | "note_added"
  | "email_sent"
  | "interview_scheduled"
  | "document_added";
export type SignalKind =
  | "open_role"
  | "funding"
  | "promotion"
  | "leadership"
  | "expansion";
// The two surfaces that hold a conversation. runAsk, the tool dispatcher and
// the run log are all about these and only these.
export type ChatSurface = "market" | "ops";

// Every surface that spends credits through begin_ask and finish_ask. Content
// generation shares that lifecycle exactly, but it has no tools, no history
// and no transcript, so widening ChatSurface would have handed run.ts and the
// run log a case they can never serve.
export type CreditSurface = ChatSurface | "content";
export type ChatRole = "user" | "assistant";
export type MailboxProvider = "google" | "microsoft" | "smtp";
export type MailboxStatus = "connected" | "warming" | "error";
export type SequenceStatus = "running" | "paused" | "draft";
export type StepChannel = "email" | "linkedin";
/**
 * `publishing` and `failed` (PLS-87) belong to the publisher, not to a person.
 * Nothing in the UI moves a post into either one: the cron claims into
 * `publishing` and settles into `published` or `failed`. `MANUAL_STATUSES` is
 * what a human is allowed to choose, and the setter checks against it.
 */
export type PostStatus =
  | "idea"
  | "drafted"
  | "needs_review"
  | "scheduled"
  | "publishing"
  | "published"
  | "needs_attention"
  | "failed";

/**
 * What a human is allowed to choose. `setPostStatus` enforces it.
 *
 * `needs_review` joins the list in PLS-134: a person can send a draft back for
 * review, and the Figma board makes it a column you can drag into.
 *
 * `needs_attention` deliberately does NOT. Like `publishing` and `failed`, it
 * belongs to the publisher: it means Pulse tried to send this and could not
 * reach LinkedIn. A human asserting it would be claiming an attempt that never
 * happened. It is cleared by fixing the account and rescheduling, not by
 * picking a different word from a dropdown.
 */
export const MANUAL_STATUSES = [
  "idea",
  "drafted",
  "needs_review",
  "scheduled",
  "published",
] as const satisfies readonly PostStatus[];

export type ManualPostStatus = (typeof MANUAL_STATUSES)[number];
export type ContentSkill =
  | "jd_post"
  | "personal_story"
  | "market_insight"
  | "candidate_story"
  | "hiring_advice";

// A line under an answer saying where it came from. `url` is present when the
// source is a page on the open web and absent when it is the org's own data,
// which is exactly the difference between the two surfaces.
export type ChatSource = { label: string; detail: string; url?: string };

export type OrgRow = {
  id: string;
  name: string;
  slug: string;
  // The zone the content calendar counts days in. Server and client both format
  // against this one value, so a post never lands on a different square
  // depending on where the viewer is sitting.
  timezone: string;
  created_at: string;
};

export type MembershipRow = {
  id: string;
  org_id: string;
  user_id: string;
  role: OrgRole;
  created_at: string;
};

export type CompanyRow = {
  id: string;
  org_id: string;
  name: string;
  domain: string;
  type: CompanyType;
  location: string;
  headcount: string;
  owner_id: string | null;
  created_at: string;
};

export type JobRow = {
  id: string;
  org_id: string;
  company_id: string | null;
  ref: string;
  title: string;
  state: JobState;
  talent_pool: string;
  hired: number;
  target: number;
  opens_at: string | null;
  closes_at: string | null;
  // The public application link's capability. Null means no link exists;
  // nulling it revokes every copy that was ever shared.
  application_slug: string | null;
  created_at: string;
};

export type StageRow = {
  id: string;
  org_id: string;
  job_id: string;
  name: string;
  position: number;
};

export type CandidateRow = {
  id: string;
  org_id: string;
  ref: string;
  job_id: string;
  stage_id: string;
  name: string;
  email: string;
  phone: string;
  title: string;
  company_name: string;
  location: string;
  linkedin_url: string;
  salary: string;
  source: string;
  match: number;
  owner_id: string | null;
  archived_at: string | null;
  last_activity_at: string;
  created_at: string;
  // Values for the admin-defined columns in person_field_defs, keyed by def
  // key. Adding a field is a defs row, never a migration.
  custom_fields: Record<string, string>;
};

export type CustomFieldType = "text" | "long_text" | "select" | "url";

export type PersonFieldDefRow = {
  id: string;
  org_id: string;
  key: string;
  label: string;
  field_type: CustomFieldType;
  options: string[];
  sort: number;
  created_at: string;
};

export type NoteRow = {
  id: string;
  org_id: string;
  candidate_id: string;
  author_id: string | null;
  body: string;
  created_at: string;
};

export type ActivityRow = {
  id: string;
  org_id: string;
  candidate_id: string;
  kind: ActivityKind;
  summary: string;
  actor_id: string | null;
  created_at: string;
};

export type DreamCompanyRow = {
  id: string;
  org_id: string;
  name: string;
  domain: string;
  industry: string;
  headcount: string;
  tier: number;
  last_signal_at: string | null;
  added_at: string;
};

export type SignalRow = {
  id: string;
  org_id: string;
  dream_company_id: string;
  kind: SignalKind;
  headline: string;
  detail: string;
  source_url: string;
  detected_at: string;
  dismissed_at: string | null;
};

export type CreditRow = {
  org_id: string;
  weekly_allowance: number;
  used_this_week: number;
  // Credits claimed by a run that has not settled yet. Available credits are
  // allowance minus used minus reserved, never allowance minus used.
  reserved_this_week: number;
  resets_at: string;
};

export type ChatStatus = "running" | "complete" | "failed";

export type ChatRow = {
  id: string;
  org_id: string;
  surface: ChatSurface;
  role: ChatRole;
  body: string;
  sources: ChatSource[];
  credits_spent: number;
  author_id: string | null;
  created_at: string;
  // A message is a run with a lifecycle. `running` means the engine is still
  // working, `failed` means it stopped and the reservation went back.
  status: ChatStatus;
  reserved_credits: number;
  error: string | null;
  // How the answer was built and what it cost: model, tokens, searches, pages.
  // This is what makes a credit charge auditable rather than trusted.
  meta: Record<string, unknown>;
  // The thread this belongs to. Nullable only for rows written before
  // PLS-105; every existing one was adopted by that migration.
  conversation_id: string | null;
};

/**
 * A thread on a chat surface (PLS-105).
 *
 * `title` is taken from the first question rather than asked for, because
 * nobody names a conversation before they have had it. `last_message_at` is
 * what the history panel sorts on, so replying to an old thread brings it
 * back to the top.
 */
export type ChatConversationRow = {
  id: string;
  org_id: string;
  surface: ChatSurface;
  title: string;
  author_id: string | null;
  created_at: string;
  last_message_at: string;
};

/**
 * A promise, and how it went (PLS-109).
 *
 * `said_at` is separate from `created_at` because Mara can log a commitment
 * made earlier in a thread than the moment the row is written. The ledger
 * ages against said_at, which is what the recruiter actually remembers.
 */
export type BDCommitmentStatus = "open" | "done" | "dropped";
export type BDCommitmentSource = "said" | "play" | "manual";

export type BDCommitmentRow = {
  id: string;
  org_id: string;
  user_id: string;
  body: string;
  source: BDCommitmentSource;
  message_id: string | null;
  status: BDCommitmentStatus;
  created_at: string;
  said_at: string;
  settled_at: string | null;
};

export type BDDebriefOutcome =
  | "went_well"
  | "still_chasing"
  | "dead_end"
  | "skipped";

export type BDDebriefRow = {
  id: string;
  org_id: string;
  user_id: string;
  commitment_id: string;
  outcome: BDDebriefOutcome;
  note: string;
  asked_on: string;
  created_at: string;
};

export type CreditEventRow = {
  id: string;
  org_id: string;
  message_id: string | null;
  kind: "reserve" | "settle" | "refund";
  amount: number;
  detail: string;
  created_at: string;
};

// Pillar 1 keeps commercial context explicit. Agency rows are shared strategy;
// personal rows are one recruiter's coaching preferences. Neither is a source
// for a market claim, which still has to come from Exa.
export type BDMemoryScope = "agency" | "personal";
export type BDMemoryKind =
  | "positioning"
  | "ideal_client"
  | "buyer"
  | "territory"
  | "offer"
  | "qualification"
  | "preference"
  | "feedback";
export type BDMemorySource = "manual" | "feedback";

/**
 * The two titles a feedback memory carries.
 *
 * The write side sets them and the read side maps them back to the rating, so
 * they live here rather than as string literals in two files that would drift
 * the first time somebody reworded one. `actions.ts` is "use server" and can
 * only export async functions, which is why this is not there.
 */
export const BD_FEEDBACK_TITLE = {
  useful: "Useful coaching",
  off_target: "Coaching correction",
} as const;

export type BDFeedbackRating = keyof typeof BD_FEEDBACK_TITLE;

export type BDAgentMemoryRow = {
  id: string;
  org_id: string;
  scope: BDMemoryScope;
  user_id: string | null;
  kind: BDMemoryKind;
  title: string;
  body: string;
  source: BDMemorySource;
  answer_id: string | null;
  created_at: string;
  updated_at: string;
};

// An Exa response we already paid to fetch. Its expiry determines whether it
// is still useful, and its org_id means no agency ever shares a query trail.
export type BDResearchCacheRow = {
  id: string;
  org_id: string;
  cache_key: string;
  kind: "search" | "page";
  payload: unknown;
  created_at: string;
  expires_at: string;
};

export type TaskStatus =
  | "todo"
  | "in_progress"
  | "pending"
  | "blocked"
  | "completed";
export type TaskPriority = "low" | "normal" | "high" | "urgent";

export type TaskRow = {
  id: string;
  org_id: string;
  ref: string;
  title: string;
  detail: string;
  due: string | null;
  done_at: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  done_by: string | null;
  origin: "claude" | "manual";
  candidate_id: string | null;
  company_id: string | null;
  created_at: string;
};

// One stream, two kinds of entry. A system row is the audit trail and nobody
// may edit it; a comment belongs to its author. A null author_id is an entry
// with no human behind it, which is how a task Claude filed says so.
export type TaskCommentRow = {
  id: string;
  org_id: string;
  task_id: string;
  author_id: string | null;
  kind: "comment" | "system";
  body: string;
  reply_to: string | null;
  created_at: string;
  edited_at: string | null;
  deleted_at: string | null;
  // What the stream is ordered by. created_at cannot be: create_task writes
  // two entries in one transaction, now() is the transaction start time, so
  // both carry the same stamp and ordering by it is a tie Postgres resolves by
  // heap order. Same defect as PLS-99's transcript. A timestamp is not an
  // ordering.
  seq: number;
};

// Who hears about a new comment. Deliberately separate from assignees: you can
// care about a task you are not carrying, and an @mention is how you get added.
export type TaskWatcherRow = {
  task_id: string;
  user_id: string;
  org_id: string;
  created_at: string;
};

// Who owns a task. The join table is the only truth: there is deliberately no
// assignee column on tasks, because a single column cannot say "these three".
export type TaskAssigneeRow = {
  task_id: string;
  user_id: string;
  org_id: string;
  created_at: string;
};

// A teammate, as org_members() reports them. The only window onto auth.users.
export type OrgMember = {
  user_id: string;
  email: string;
  display_name: string;
  role: OrgRole;
};

export type NotificationRow = {
  id: string;
  org_id: string;
  user_id: string;
  kind: string;
  title: string;
  body: string;
  href: string;
  read_at: string | null;
  created_at: string;
};

export type MailboxRow = {
  id: string;
  org_id: string;
  address: string;
  provider: MailboxProvider;
  status: MailboxStatus;
  daily_cap: number;
  sent_today: number;
  warmup_days: number;
  created_at: string;
};

export type SequenceRow = {
  id: string;
  org_id: string;
  ref: string;
  name: string;
  status: SequenceStatus;
  signal_trigger: SignalKind | null;
  enrolled: number;
  replied: number;
  booked: number;
  created_at: string;
};

export type SequenceStepRow = {
  id: string;
  org_id: string;
  sequence_id: string;
  channel: StepChannel;
  day_offset: number;
  subject: string | null;
  body: string;
  position: number;
};

export type PostRow = {
  id: string;
  org_id: string;
  ref: string;
  skill: ContentSkill;
  hook: string;
  body: string;
  status: PostStatus;
  scheduled_for: string | null;
  published_at: string | null;
  author_id: string | null;
  created_at: string;
  updated_at: string;
  // Set when the post uses an org-defined shape instead of a built-in one.
  // `skill` still carries a valid value so every existing reader keeps working.
  shape_id: string | null;
  // The body as generated, kept so a later edit can be diffed against it.
  // Null means a human wrote this from scratch and there is nothing to learn.
  generated_body: string | null;
  // PLS-87 publishing. False on everything that was already dated when the
  // publisher shipped, so old drafts could not fire the minute it started.
  auto_publish: boolean;
  post_url: string | null;
  // The real reason LinkedIn refused, shown on the post. A post that just says
  // "failed" tells a recruiter nothing they can act on.
  publish_error: string | null;
  publish_attempts: number;
  // PLS-135. Why Pulse could not send this, when the problem is the account
  // rather than the post. Set alongside `needs_attention` and cleared by a
  // successful publish. Distinct from `publish_error`, which is LinkedIn
  // refusing the words: this one is actionable and that one needs a rewrite.
  attention_reason: string | null;
};

/**
 * A recruiter's voice. One per person.
 *
 * Built from pasted material, never a scrape: Exa reads cache-first public
 * pages truncated to 2400 characters and cannot sign in to LinkedIn, so a
 * scraped persona would be quietly weak.
 */
export type PersonaRow = {
  id: string;
  org_id: string;
  user_id: string;
  headline: string;
  about: string;
  proud_posts: string[];
  flop_posts: string[];
  voice_profile: VoiceProfile;
  built_at: string | null;
  created_at: string;
  updated_at: string;
};

/** The distilled voice the generator reads. Jsonb, so it can grow. */
export type VoiceProfile = {
  summary?: string;
  tone?: string[];
  openings?: string[];
  rhythm?: string;
  banned?: string[];
  proof?: string[];
};

export type PersonaLessonRow = {
  id: string;
  org_id: string;
  persona_id: string;
  post_id: string | null;
  generated: string;
  published: string;
  lesson: string;
  applied_at: string | null;
  created_at: string;
};

/** A post shape an org added for itself, beside the five built into the app. */
export type ContentShapeRow = {
  id: string;
  org_id: string;
  key: string;
  name: string;
  blurb: string;
  prompt: string;
  created_by: string | null;
  sort: number;
  created_at: string;
};

/**
 * A shape as the UI consumes it, whether it came from code or from the
 * database. `id` is null for the five built-ins, which is exactly the flag
 * that decides whether a post carries `shape_id`.
 */
export type Shape = {
  id: string | null;
  key: string;
  name: string;
  blurb: string;
  prompt: string;
};

// Media attached to a post. `url` is not a column: it is a short-lived signed
// URL minted at read time, because the bucket is private and a stored URL would
// either expire in the database or never expire at all.
export type AssetRow = {
  id: string;
  org_id: string;
  post_id: string;
  storage_path: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  sort: number;
  created_at: string;
};

export type PostAsset = AssetRow & { url: string | null };

// A LinkedIn profile connected through Unipile's hosted wizard. Not a
// credential: RecruiterGTM holds one Unipile tenant and this is an account
// under it, which is why there is no key on this row to leak.
/**
 * What a published post actually did, as LinkedIn reported it.
 *
 * PLS-136. Every counter is `number | null`, and null is not a nuisance to
 * default away: it means LinkedIn did not report that figure. Zero means nobody
 * engaged. Rendering a null as 0 turns "we do not know" into a measurement,
 * which is the never-fabricate rule applied to arithmetic rather than prose.
 *
 * `impressions` is the field most often null. Reactions, comments and reposts
 * come back dependably; impressions come from LinkedIn's own analytics, which a
 * personal profile may not expose. Nothing may substitute one for the other.
 */
export type PostMetricsRow = {
  id: string;
  org_id: string;
  post_id: string;
  impressions: number | null;
  likes: number | null;
  comments: number | null;
  reposts: number | null;
  source: "unipile";
  fetched_at: string;
  created_at: string;
};

export type LinkedInAccountStatus = "connected" | "credentials" | "disconnected";

export type LinkedInAccountRow = {
  id: string;
  org_id: string;
  unipile_account_id: string;
  display_name: string;
  status: LinkedInAccountStatus;
  connected_by: string | null;
  last_error: string;
  connected_at: string;
  updated_at: string;
};

// ---------------------------------------------------------------------------
// The person / candidacy model (PLS-45). Stage lives on the candidacy, so one
// human can sit at a different stage on every role they are on, while notes,
// files and history follow the person.
// ---------------------------------------------------------------------------

export type FileKind = "resume" | "headshot" | "video" | "other";

export type PersonRow = {
  id: string;
  org_id: string;
  ref: string;
  name: string;
  email: string;
  phone: string;
  title: string;
  company_name: string;
  location: string;
  linkedin_url: string;
  salary_expectation: string;
  source: string;
  owner_id: string | null;
  rating: number | null;
  headshot_path: string | null;
  headshot_url: string | null;
  resume_path: string | null;
  resume_url: string | null;
  video_url: string | null;
  last_contacted_at: string | null;
  replied: boolean;
  created_at: string;
  updated_at: string;
};

export type CandidacyRow = {
  id: string;
  org_id: string;
  person_id: string;
  job_id: string;
  stage_id: string;
  sort: number;
  source: string;
  match: number;
  archived_at: string | null;
  last_activity_at: string;
  created_at: string;
};

// A board card: the candidacy joined to its person. `id` is the CANDIDACY id
// and `person_id` is the human. Getting those two confused is the single most
// error-prone thing in this model, so the type keeps them both explicit.
export type BoardCard = CandidacyRow & { person: PersonRow };

export type StageEventRow = {
  id: string;
  org_id: string;
  candidacy_id: string;
  from_stage_id: string | null;
  to_stage_id: string;
  actor_id: string | null;
  created_at: string;
};

export type PersonFileRow = {
  id: string;
  org_id: string;
  person_id: string;
  kind: FileKind;
  label: string;
  path: string | null;
  url: string | null;
  mime: string;
  size_bytes: number;
  created_at: string;
};

export type ShortlistRow = {
  id: string;
  org_id: string;
  job_id: string;
  ref: string;
  token: string;
  title: string;
  client_name: string;
  prepared_for: string;
  person_ids: string[];
  view_count: number;
  revoked_at: string | null;
  created_at: string;
};
