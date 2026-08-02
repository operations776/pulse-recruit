// Domain types. Shaped to match the tables in ARCHITECTURE.md so swapping the
// mock store for Supabase is a data-layer change, not a component rewrite.
// Every tenant-scoped record carries orgId, exactly as every table carries org_id.

export type Role = "owner" | "admin" | "member";

export type Member = {
  id: string;
  orgId: string;
  name: string;
  email: string;
  role: Role;
  avatarUrl?: string;
};

export type Org = {
  id: string;
  name: string;
  slug: string;
};

export type CompanyType = "client" | "prospect";

export type Company = {
  id: string;
  orgId: string;
  name: string;
  domain: string;
  type: CompanyType;
  location: string;
  headcount: string;
  ownerId: string;
  createdAt: string;
};

export type Job = {
  id: string;
  orgId: string;
  companyId: string;
  title: string;
  code: string;
  state: "open" | "risk" | "closed";
  talentPool: string;
  hired: number;
  target: number;
  opensAt: string;
  closesAt: string;
  assigneeIds: string[];
};

export type Stage = {
  id: string;
  orgId: string;
  jobId: string;
  name: string;
  position: number;
};

export type Candidate = {
  id: string;
  orgId: string;
  jobId: string;
  stageId: string;
  name: string;
  email: string;
  phone: string;
  title: string;
  companyName: string;
  location: string;
  linkedinUrl: string;
  salary: string;
  source: string;
  match: number;
  ownerId: string;
  lastActivityAt: string;
  createdAt: string;
  avatarUrl?: string;
};

export type Note = {
  id: string;
  orgId: string;
  candidateId: string;
  authorId: string;
  body: string;
  createdAt: string;
};

export type ActivityKind =
  | "created"
  | "stage_changed"
  | "note_added"
  | "email_sent"
  | "interview_scheduled"
  | "document_added";

export type ActivityEvent = {
  id: string;
  orgId: string;
  candidateId: string;
  kind: ActivityKind;
  summary: string;
  actorId: string;
  createdAt: string;
};

export type Signal = {
  id: string;
  orgId: string;
  kind: "open_role" | "funding" | "leadership" | "expansion";
  companyName: string;
  domain: string;
  headline: string;
  detail: string;
  detectedAt: string;
  dismissed: boolean;
};

// Counts rendered on candidate cards. Derived, never stored.
export type CandidateMetrics = {
  emails: number;
  notes: number;
  documents: number;
  interviews: number;
};
