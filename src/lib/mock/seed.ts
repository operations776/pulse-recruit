import type {
  ActivityEvent,
  Candidate,
  Company,
  Job,
  Member,
  Note,
  Org,
  Signal,
  Stage,
} from "@/lib/types";

// Deterministic seed. No Math.random and no Date.now anywhere: server and client
// must render identical output or React reports a hydration mismatch.
// NOW is the fixed reference point every relative time is measured against.
export const NOW = new Date("2026-08-02T09:00:00.000Z");

const hoursAgo = (h: number) =>
  new Date(NOW.getTime() - h * 3_600_000).toISOString();
const daysAgo = (d: number) => hoursAgo(d * 24);

export const ORG: Org = {
  id: "org_1",
  name: "Nortech Search",
  slug: "nortech-search",
};

export const MEMBERS: Member[] = [
  { id: "u_1", orgId: ORG.id, name: "Daniyal Aziz", email: "daniyal@nortech.io", role: "owner" },
  { id: "u_2", orgId: ORG.id, name: "Reyhan Khan", email: "reyhan@nortech.io", role: "admin" },
  { id: "u_3", orgId: ORG.id, name: "Salar Mansoor", email: "salar@nortech.io", role: "member" },
  { id: "u_4", orgId: ORG.id, name: "Shmookh Taish", email: "shmookh@nortech.io", role: "member" },
];

export const CURRENT_USER = MEMBERS[0];

export const COMPANIES: Company[] = [
  { id: "c_1", orgId: ORG.id, name: "Corewave", domain: "corewave.com", type: "client", location: "London, UK", headcount: "120-250", ownerId: "u_1", createdAt: daysAgo(180) },
  { id: "c_2", orgId: ORG.id, name: "Fieldstone", domain: "fieldstone.com", type: "client", location: "Manchester, UK", headcount: "50-120", ownerId: "u_2", createdAt: daysAgo(150) },
  { id: "c_3", orgId: ORG.id, name: "Brightpath", domain: "brightpath.dev", type: "client", location: "Berlin, DE", headcount: "20-50", ownerId: "u_1", createdAt: daysAgo(90) },
  { id: "c_4", orgId: ORG.id, name: "Vantora", domain: "vantora.co", type: "client", location: "Austin, US", headcount: "250-500", ownerId: "u_3", createdAt: daysAgo(60) },
  { id: "c_5", orgId: ORG.id, name: "Halston Group", domain: "halston.io", type: "prospect", location: "Dublin, IE", headcount: "50-120", ownerId: "u_2", createdAt: daysAgo(30) },
  { id: "c_6", orgId: ORG.id, name: "Cloudline", domain: "cloudline.dev", type: "prospect", location: "Amsterdam, NL", headcount: "20-50", ownerId: "u_1", createdAt: daysAgo(21) },
  { id: "c_7", orgId: ORG.id, name: "Meridian Labs", domain: "meridian.co", type: "prospect", location: "New York, US", headcount: "120-250", ownerId: "u_4", createdAt: daysAgo(14) },
  { id: "c_8", orgId: ORG.id, name: "Northstar Systems", domain: "northstar.tech", type: "prospect", location: "Toronto, CA", headcount: "500+", ownerId: "u_3", createdAt: daysAgo(7) },
];

export const JOBS: Job[] = [
  { id: "j_1", orgId: ORG.id, companyId: "c_1", title: "Senior Product Designer", code: "P_001", state: "open", talentPool: "Product design", hired: 1, target: 10, opensAt: "2026-01-01", closesAt: "2026-02-01", assigneeIds: ["u_2", "u_3", "u_1"] },
  { id: "j_2", orgId: ORG.id, companyId: "c_2", title: "Middle Business Analyst", code: "P_002", state: "open", talentPool: "Analytics", hired: 0, target: 4, opensAt: "2026-01-15", closesAt: "2026-03-01", assigneeIds: ["u_2"] },
  { id: "j_3", orgId: ORG.id, companyId: "c_3", title: "Assistant Product Manager", code: "P_003", state: "risk", talentPool: "Product", hired: 0, target: 2, opensAt: "2026-02-01", closesAt: "2026-03-15", assigneeIds: ["u_1", "u_4"] },
  { id: "j_4", orgId: ORG.id, companyId: "c_4", title: "Scrum Master", code: "P_004", state: "open", talentPool: "Delivery", hired: 2, target: 3, opensAt: "2026-02-10", closesAt: "2026-04-01", assigneeIds: ["u_3"] },
  { id: "j_5", orgId: ORG.id, companyId: "c_1", title: "UX Writer", code: "P_006", state: "open", talentPool: "Product design", hired: 0, target: 1, opensAt: "2026-03-01", closesAt: "2026-04-15", assigneeIds: ["u_4"] },
  { id: "j_6", orgId: ORG.id, companyId: "c_2", title: "Middle Project Manager", code: "P_005", state: "closed", talentPool: "Delivery", hired: 3, target: 3, opensAt: "2025-11-01", closesAt: "2026-01-10", assigneeIds: ["u_2", "u_3"] },
  { id: "j_7", orgId: ORG.id, companyId: "c_3", title: "UX Research Lead", code: "P_007", state: "closed", talentPool: "Product design", hired: 1, target: 1, opensAt: "2025-12-01", closesAt: "2026-01-20", assigneeIds: ["u_1"] },
];

const STAGE_NAMES = ["Applied", "Test", "Interview", "Offer", "Hired"];

export const STAGES: Stage[] = JOBS.flatMap((job) =>
  STAGE_NAMES.map((name, position) => ({
    id: `s_${job.id}_${position}`,
    orgId: ORG.id,
    jobId: job.id,
    name,
    position,
  })),
);

type Row = [
  name: string,
  email: string,
  phone: string,
  title: string,
  company: string,
  location: string,
  salary: string,
  source: string,
  match: number,
  stage: number,
  hours: number,
  owner: string,
];

const J1: Row[] = [
  ["Laurie Kessler", "laurie.kessler@nortech.io", "+44 7700 900111", "Product Designer", "Studio Nine", "London, UK", "£72,000", "LinkedIn", 72, 0, 3, "u_1"],
  ["Clementine Spencer", "c.spencer@fieldstone.com", "+44 7700 900112", "Senior Product Designer", "Fieldstone", "Manchester, UK", "£85,000", "Referral", 98, 0, 5, "u_1"],
  ["Karlie Pfannerstill", "karlie.p@brightpath.dev", "+49 151 2345678", "Product Designer", "Brightpath", "Berlin, DE", "€78,000", "Inbound", 49, 0, 96, "u_2"],
  ["Rylee Thiel", "rylee@cloudline.dev", "+31 6 12345678", "UX Designer", "Cloudline", "Amsterdam, NL", "€70,000", "Exa signal", 68, 0, 288, "u_1"],
  ["Alysa Kunde", "alysa.kunde@meridian.co", "+1 512 555 0134", "Product Designer", "Meridian Labs", "New York, US", "$115,000", "LinkedIn", 77, 0, 144, "u_3"],
  ["Berry Shields", "berry.shields@corewave.com", "+44 7700 900113", "Staff Designer", "Corewave", "London, UK", "£95,000", "Referral", 100, 1, 1, "u_1"],
  ["Fay Nitzsche", "fay@halston.io", "+353 85 123 4567", "Senior Designer", "Halston Group", "Dublin, IE", "€88,000", "Inbound", 98, 1, 2, "u_2"],
  ["Jace Hackett", "jace.hackett@vantora.co", "+1 512 555 0198", "Product Designer", "Vantora", "Austin, US", "$120,000", "LinkedIn", 82, 1, 72, "u_3"],
  ["Daisy Ullrich", "daisy.ullrich@nortech.io", "+44 7700 900114", "Lead Product Designer", "Northstar Systems", "Toronto, CA", "CA$140,000", "Referral", 100, 2, 1, "u_1"],
  ["Aaron Johnson", "aaron.j@fieldstone.com", "+44 7700 900115", "Senior Product Designer", "Fieldstone", "Manchester, UK", "£88,000", "Inbound", 86, 2, 6, "u_2"],
  ["Abigail Thompson", "abigail@brightpath.dev", "+49 151 8765432", "Product Designer", "Brightpath", "Berlin, DE", "€82,000", "Exa signal", 79, 2, 48, "u_4"],
  ["Felix Garcia", "felix.garcia@corewave.com", "+44 7700 900116", "Principal Designer", "Corewave", "London, UK", "£110,000", "Referral", 91, 2, 216, "u_1"],
  ["Eleanor Taylor", "eleanor.taylor@vantora.co", "+1 512 555 0177", "Design Lead", "Vantora", "Austin, US", "$155,000", "Referral", 96, 3, 0.3, "u_1"],
  ["Daniel Brown", "daniel.brown@halston.io", "+353 85 987 6543", "Senior Designer", "Halston Group", "Dublin, IE", "€92,000", "LinkedIn", 88, 3, 72, "u_3"],
  ["Marcus Webb", "marcus.webb@meridian.co", "+1 212 555 0110", "Head of Design", "Meridian Labs", "New York, US", "$180,000", "Referral", 94, 4, 12, "u_1"],
];

const J2: Row[] = [
  ["Priya Nair", "priya.nair@cloudline.dev", "+31 6 87654321", "Business Analyst", "Cloudline", "Amsterdam, NL", "€65,000", "LinkedIn", 81, 0, 4, "u_2"],
  ["Tom Okafor", "tom.okafor@meridian.co", "+1 212 555 0142", "Senior Analyst", "Meridian Labs", "New York, US", "$105,000", "Inbound", 74, 0, 120, "u_2"],
  ["Elena Vasquez", "elena.v@brightpath.dev", "+49 151 5551234", "Business Analyst", "Brightpath", "Berlin, DE", "€68,000", "Referral", 89, 1, 8, "u_2"],
  ["James Park", "james.park@corewave.com", "+44 7700 900117", "Lead Analyst", "Corewave", "London, UK", "£78,000", "LinkedIn", 92, 2, 30, "u_2"],
];

const J3: Row[] = [
  ["Ana Duarte", "ana.duarte@halston.io", "+353 85 111 2222", "Associate PM", "Halston Group", "Dublin, IE", "€62,000", "Inbound", 70, 0, 200, "u_4"],
  ["Ryan Mitchell", "ryan.mitchell@vantora.co", "+1 512 555 0155", "Product Manager", "Vantora", "Austin, US", "$130,000", "Referral", 85, 1, 26, "u_1"],
];

const J4: Row[] = [
  ["Sofia Almeida", "sofia@northstar.tech", "+1 416 555 0101", "Scrum Master", "Northstar Systems", "Toronto, CA", "CA$105,000", "LinkedIn", 90, 2, 5, "u_3"],
  ["Henrik Olsen", "henrik.olsen@cloudline.dev", "+47 400 12345", "Agile Coach", "Cloudline", "Oslo, NO", "kr 950,000", "Inbound", 76, 1, 60, "u_3"],
];

const J5: Row[] = [
  ["Nadia Rahman", "nadia.rahman@corewave.com", "+44 7700 900118", "UX Writer", "Corewave", "London, UK", "£62,000", "Referral", 87, 0, 9, "u_4"],
];

function buildCandidates(): Candidate[] {
  const groups: [string, Row[]][] = [
    ["j_1", J1],
    ["j_2", J2],
    ["j_3", J3],
    ["j_4", J4],
    ["j_5", J5],
  ];

  return groups.flatMap(([jobId, rows]) =>
    rows.map((r, i) => {
      const [name, email, phone, title, companyName, location, salary, source, match, stage, hours, ownerId] = r;
      return {
        id: `cand_${jobId}_${i}`,
        orgId: ORG.id,
        jobId,
        stageId: `s_${jobId}_${stage}`,
        name,
        email,
        phone,
        title,
        companyName,
        location,
        linkedinUrl: `https://linkedin.com/in/${name.toLowerCase().replace(/[^a-z]+/g, "-")}`,
        salary,
        source,
        match,
        ownerId,
        lastActivityAt: hoursAgo(hours),
        createdAt: daysAgo(30 + i),
      } satisfies Candidate;
    }),
  );
}

export const CANDIDATES: Candidate[] = buildCandidates();

export const NOTES: Note[] = [
  { id: "n_1", orgId: ORG.id, candidateId: "cand_j_1_1", authorId: "u_1", body: "Strong portfolio, led the design system rebuild at Fieldstone. Wants a step up into a lead role and is open to hybrid in London.", createdAt: hoursAgo(6) },
  { id: "n_2", orgId: ORG.id, candidateId: "cand_j_1_1", authorId: "u_2", body: "Client asked to fast track. Scheduling the portfolio review for Thursday.", createdAt: hoursAgo(5) },
  { id: "n_3", orgId: ORG.id, candidateId: "cand_j_1_12", authorId: "u_1", body: "Verbal offer accepted, paperwork with the client. Start date targeted for the first Monday of next month.", createdAt: hoursAgo(1) },
  { id: "n_4", orgId: ORG.id, candidateId: "cand_j_1_3", authorId: "u_1", body: "No reply to two follow ups. Worth one more touch on LinkedIn before we close this out.", createdAt: daysAgo(9) },
];

export const ACTIVITY: ActivityEvent[] = [
  { id: "a_1", orgId: ORG.id, candidateId: "cand_j_1_1", kind: "created", summary: "Added to Senior Product Designer", actorId: "u_1", createdAt: daysAgo(12) },
  { id: "a_2", orgId: ORG.id, candidateId: "cand_j_1_1", kind: "email_sent", summary: "Intro email sent", actorId: "u_1", createdAt: daysAgo(11) },
  { id: "a_3", orgId: ORG.id, candidateId: "cand_j_1_1", kind: "note_added", summary: "Note added", actorId: "u_1", createdAt: hoursAgo(6) },
  { id: "a_4", orgId: ORG.id, candidateId: "cand_j_1_1", kind: "stage_changed", summary: "Moved to Applied", actorId: "u_2", createdAt: hoursAgo(5) },
  { id: "a_5", orgId: ORG.id, candidateId: "cand_j_1_12", kind: "interview_scheduled", summary: "Final interview booked", actorId: "u_1", createdAt: hoursAgo(30) },
  { id: "a_6", orgId: ORG.id, candidateId: "cand_j_1_12", kind: "stage_changed", summary: "Moved to Offer", actorId: "u_1", createdAt: hoursAgo(2) },
];

export const SIGNALS: Signal[] = [
  { id: "sig_1", orgId: ORG.id, kind: "funding", companyName: "Northstar Systems", domain: "northstar.tech", headline: "Raised a $40M Series B", detail: "Led by Accel. Stated plan to double the product org in twelve months.", detectedAt: hoursAgo(4), dismissed: false },
  { id: "sig_2", orgId: ORG.id, kind: "open_role", companyName: "Meridian Labs", domain: "meridian.co", headline: "Posted 6 design roles this week", detail: "Three senior, two mid, one lead. No agency listed on any posting.", detectedAt: hoursAgo(9), dismissed: false },
  { id: "sig_3", orgId: ORG.id, kind: "leadership", companyName: "Halston Group", domain: "halston.io", headline: "New VP of Product started", detail: "Joined from Corewave. New leaders rebuild their teams in the first quarter.", detectedAt: hoursAgo(28), dismissed: false },
  { id: "sig_4", orgId: ORG.id, kind: "expansion", companyName: "Cloudline", domain: "cloudline.dev", headline: "Opening a London office", detail: "Job postings shifted to UK contracts in the last fourteen days.", detectedAt: daysAgo(3), dismissed: false },
  { id: "sig_5", orgId: ORG.id, kind: "open_role", companyName: "Vantora", domain: "vantora.co", headline: "Reposted the Design Lead role", detail: "Live for 62 days. A repost usually means the internal search stalled.", detectedAt: daysAgo(5), dismissed: false },
];
