import { NOW, ORG } from "@/lib/mock/seed";
import type {
  ChatMessage,
  ContentPost,
  CreditLedger,
  Mailbox,
  Sequence,
  Task,
} from "@/lib/types";

// Seed data for the four modules beyond TALENT, one block per pillar.
// Deterministic, measured against the fixed NOW, same as the ATS seed.

const hoursAgo = (h: number) =>
  new Date(NOW.getTime() - h * 3_600_000).toISOString();
const daysAgo = (d: number) => hoursAgo(d * 24);
const inDays = (d: number) =>
  new Date(NOW.getTime() + d * 86_400_000).toISOString();

// The BD engine and enrichment run on our API keys, so usage is metered
// against a weekly allowance per plan.
export const CREDITS: CreditLedger = {
  orgId: ORG.id,
  weeklyAllowance: 250,
  usedThisWeek: 88,
  resetsAt: inDays(4),
};

// Pillar 1. The BD engine answers from live market research and shows what it
// read, so the recruiter can audit the answer rather than trust it.
export const MARKET_CHAT: ChatMessage[] = [
  {
    id: "m_1",
    orgId: ORG.id,
    surface: "market",
    role: "user",
    body: "Which product design teams in London are hiring and have no in-house talent lead?",
    createdAt: hoursAgo(3),
  },
  {
    id: "m_2",
    orgId: ORG.id,
    surface: "market",
    role: "assistant",
    body: "Seven companies match. The strongest three are Meridian Labs, which posted six design roles this week with no agency named, Northstar Systems, which raised a 40M Series B and states a plan to double the product org, and Corewave, where Priya Raman was just promoted to VP Engineering and will backfill her old seat.\n\nNone of the three list a Head of Talent or TA Manager, which is the gap you sell into. Meridian is the sharpest first call because the roles are live now.",
    sources: [
      { label: "Job boards", detail: "18 postings across 7 companies, last 14 days" },
      { label: "LinkedIn", detail: "No TA leadership found at 3 of 7" },
      { label: "Funding news", detail: "Northstar Series B, 40M, led by Accel" },
    ],
    creditsSpent: 12,
    createdAt: hoursAgo(3),
  },
];

// Pillar 2. The ops manager answers from the ATS, never from the open web.
export const OPS_CHAT: ChatMessage[] = [
  {
    id: "o_1",
    orgId: ORG.id,
    surface: "ops",
    role: "user",
    body: "What needs me today?",
    createdAt: hoursAgo(1),
  },
  {
    id: "o_2",
    orgId: ORG.id,
    surface: "ops",
    role: "assistant",
    body: "Three things.\n\nRylee Thiel has been sitting in Applied for twelve days with no contact. That is the coldest record on the Senior Product Designer board.\n\nEleanor Taylor accepted verbally on the Vantora offer and the paperwork is still with the client.\n\nAssistant Product Manager is marked at risk with two candidates against a target of two, so there is no slack if either drops.",
    sources: [
      { label: "Pipeline", detail: "24 candidates across 5 live roles" },
      { label: "Activity", detail: "6 events in the last 24 hours" },
    ],
    createdAt: hoursAgo(1),
  },
];

export const TASKS: Task[] = [
  { id: "t_1", ref: "TASK-1180", orgId: ORG.id, title: "Chase Rylee Thiel", detail: "Twelve days cold in Applied. One more touch before closing the record out.", due: NOW.toISOString(), done: false, origin: "claude", linkedCandidateId: "cand_j_1_3" },
  { id: "t_2", ref: "TASK-1181", orgId: ORG.id, title: "Send Vantora the offer paperwork", detail: "Eleanor Taylor accepted verbally. The client is waiting on the contract.", due: NOW.toISOString(), done: false, origin: "claude", linkedCandidateId: "cand_j_1_12" },
  { id: "t_3", ref: "TASK-1182", orgId: ORG.id, title: "Add two more to Assistant Product Manager", detail: "Role is at risk with no slack against target.", due: inDays(1), done: false, origin: "claude" },
  { id: "t_4", ref: "TASK-1183", orgId: ORG.id, title: "Book the Corewave intro call", detail: "The Priya Raman promotion is four days old. That window closes fast.", due: inDays(2), done: false, origin: "manual" },
  { id: "t_5", ref: "TASK-1184", orgId: ORG.id, title: "Review reply data from last week", detail: "Founder outreach replied at 9 percent, worth reading before the next batch.", due: daysAgo(1), done: true, origin: "claude" },
];

// Pillar 3. Mailboxes connect here so sending happens inside Pulse.
export const MAILBOXES: Mailbox[] = [
  { id: "mb_1", orgId: ORG.id, address: "daniyal@nortech-search.com", provider: "google", status: "connected", dailyCap: 40, sentToday: 22, warmupDays: 62 },
  { id: "mb_2", orgId: ORG.id, address: "daniyal@nortechsearch.co", provider: "google", status: "connected", dailyCap: 40, sentToday: 31, warmupDays: 48 },
  { id: "mb_3", orgId: ORG.id, address: "hello@nortech-talent.com", provider: "microsoft", status: "warming", dailyCap: 15, sentToday: 6, warmupDays: 9 },
  { id: "mb_4", orgId: ORG.id, address: "reyhan@nortechsearch.co", provider: "smtp", status: "error", dailyCap: 40, sentToday: 0, warmupDays: 31 },
];

export const SEQUENCES: Sequence[] = [
  {
    id: "sq_1", ref: "SEQ-0092", orgId: ORG.id, name: "Funding raised, product hiring", status: "running",
    signalTrigger: "funding", enrolled: 84, replied: 11, booked: 4,
    mailboxIds: ["mb_1", "mb_2"], createdAt: daysAgo(21),
    steps: [
      { id: "st_1", channel: "email", dayOffset: 0, subject: "congrats on the raise", body: "Saw the Series B. Most teams that raise at your stage try to double product headcount in two quarters and stall at the senior end.\n\nWe place senior product people in London. Worth fifteen minutes?" },
      { id: "st_2", channel: "linkedin", dayOffset: 2, body: "Sent you a note on email about the raise. Happy to share what the senior design market looks like in London right now either way." },
      { id: "st_3", channel: "email", dayOffset: 5, subject: "re: congrats on the raise", body: "Following up once. If hiring is not the priority this quarter, tell me and I will stop.\n\nIf it is, I can send three profiles this week." },
    ],
  },
  {
    id: "sq_2", ref: "SEQ-0093", orgId: ORG.id, name: "Promotion, backfill window", status: "running",
    signalTrigger: "promotion", enrolled: 46, replied: 8, booked: 3,
    mailboxIds: ["mb_1"], createdAt: daysAgo(12),
    steps: [
      { id: "st_4", channel: "email", dayOffset: 0, subject: "congrats on the step up", body: "Saw the move to VP. The seat you just left usually gets backfilled slower than anyone plans for.\n\nWe cover that level in London. Want three names this week?" },
      { id: "st_5", channel: "linkedin", dayOffset: 3, body: "Congrats again on the promotion. If you are backfilling your old role, happy to help." },
    ],
  },
  {
    id: "sq_3", ref: "SEQ-0094", orgId: ORG.id, name: "Reposted role, search stalled", status: "paused",
    signalTrigger: "open_role", enrolled: 31, replied: 2, booked: 0,
    mailboxIds: ["mb_2"], createdAt: daysAgo(30),
    steps: [
      { id: "st_6", channel: "email", dayOffset: 0, subject: "the design lead role", body: "The Design Lead posting has been live for sixty days and just got reposted. Usually that means the internal search stalled.\n\nWe fill that level in about three weeks. Worth a call?" },
    ],
  },
  {
    id: "sq_4", ref: "SEQ-0095", orgId: ORG.id, name: "New VP, team rebuild", status: "draft",
    signalTrigger: "leadership", enrolled: 0, replied: 0, booked: 0,
    mailboxIds: [], createdAt: daysAgo(2),
    steps: [
      { id: "st_7", channel: "email", dayOffset: 0, subject: "first ninety days", body: "New leaders rebuild their team in the first quarter. Draft copy, not sent yet." },
    ],
  },
];

// Pillar 5. Every post is written through a named skill, never free text.
export const POSTS: ContentPost[] = [
  { id: "p_1", ref: "POST-0031", orgId: ORG.id, skill: "market_insight", hook: "Six design roles went live in London this week. None of them named an agency.", body: "Six design roles went live in London this week. None of them named an agency.\n\nThat is not a gap in the market, it is a gap in trust. Agencies get named when a client has been burned by a bad internal search, not before.\n\nHere is what the good ones do differently.", status: "published", scheduledFor: daysAgo(2), createdAt: daysAgo(4) },
  { id: "p_2", ref: "POST-0032", orgId: ORG.id, skill: "personal_story", hook: "I lost a placement last week over a two day delay.", body: "I lost a placement last week over a two day delay.\n\nThe candidate was ready. The client was ready. The paperwork sat in an inbox over a weekend and by Monday she had another offer.\n\nSpeed is not a nice to have in this job. It is the job.", status: "scheduled", scheduledFor: inDays(1), createdAt: daysAgo(1) },
  { id: "p_3", ref: "POST-0033", orgId: ORG.id, skill: "jd_post", hook: "Senior Product Designer, London, hybrid, up to 85k.", body: "Senior Product Designer, London, hybrid, up to 85k.\n\nDesign system ownership, a real research function, and a product team that ships weekly.\n\nDrop me a note if you want the full brief.", status: "drafted", scheduledFor: null, createdAt: hoursAgo(6) },
  { id: "p_4", ref: "POST-0034", orgId: ORG.id, skill: "candidate_story", hook: "She was rejected twice by the same company. The third time she got the lead role.", body: "", status: "idea", scheduledFor: null, createdAt: hoursAgo(2) },
  { id: "p_5", ref: "POST-0035", orgId: ORG.id, skill: "hiring_advice", hook: "Your take home test is why good people drop out.", body: "", status: "idea", scheduledFor: null, createdAt: hoursAgo(20) },
];
