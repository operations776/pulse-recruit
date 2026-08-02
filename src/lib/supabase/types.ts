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
export type ChatSurface = "market" | "ops";
export type ChatRole = "user" | "assistant";
export type MailboxProvider = "google" | "microsoft" | "smtp";
export type MailboxStatus = "connected" | "warming" | "error";
export type SequenceStatus = "running" | "paused" | "draft";
export type StepChannel = "email" | "linkedin";
export type PostStatus = "idea" | "drafted" | "scheduled" | "published";
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

export type TaskRow = {
  id: string;
  org_id: string;
  ref: string;
  title: string;
  detail: string;
  due: string | null;
  done_at: string | null;
  origin: "claude" | "manual";
  candidate_id: string | null;
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
  author_id: string | null;
  created_at: string;
};
