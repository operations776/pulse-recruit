import { MaraStage } from "@/components/mara/stage";
import type { Metric } from "@/components/mara/metrics";
import type { Domain } from "@/components/mara/persona-panel";
import { getBDWorkspace, getMaraBoard } from "@/lib/data";
import { hasResearchKey } from "@/lib/server/ai/exa";
import { hasModelKey } from "@/lib/server/ai/openai";

import { agent } from "@/config/brand";
// Pillar 1. The BD strategist. Named in config/brand.ts, currently Reyhan.
//
// It researches with Exa, reasons over what it finds, and remembers the
// strategy and coaching this agency has told it. The answer is only worth as
// much as the sources under it, so every briefing carries them, and a run that
// read nothing fails rather than answering (AI.md section 5).
//
// Everything on this screen is either something the recruiter told it, or a
// row that already exists, or something it researched. There is no fourth
// category. The one number with no source, BD time, says so on its face
// instead of showing a plausible figure.

/** "4 minutes ago", "yesterday". Fixed server-side so it cannot drift. */
function humanise(iso: string | null, nowMs: number): string {
  if (!iso) return "waiting on your first question";
  const minutes = Math.floor((nowMs - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return "read your patch just now";
  if (minutes < 60) return `read your patch ${minutes} minutes ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `read your patch ${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  const days = Math.floor(hours / 24);
  return `read your patch ${days} ${days === 1 ? "day" : "days"} ago`;
}

export default async function BDStrategistPage({
  searchParams,
}: {
  // q and memory are pushed by buttons on this very screen. They were not
  // read, so "Ask Reyhan how" and "Manage" changed the URL and did nothing.
  searchParams: Promise<{ c?: string; q?: string; memory?: string }>;
}) {
  const params = await searchParams;
  // `c=new` is how the New conversation button says "do not open anything":
  // it is not an id, so nothing matches and the transcript renders empty.
  const requested = params.c && params.c !== "new" ? params.c : undefined;

  const [workspace, board] = await Promise.all([
    getBDWorkspace(requested, params.c === "new"),
    getMaraBoard(),
  ]);

  const {
    session,
    messages,
    credits,
    memories,
    feedbackByAnswer,
    conversations,
    activeConversationId,
  } = workspace;

  const allowance = credits?.weekly_allowance ?? 0;
  const used = credits?.used_this_week ?? 0;
  // Reserved credits belong to a run in flight. Showing them as available is
  // how you promise a question you cannot pay for.
  const reserved = credits?.reserved_this_week ?? 0;
  const available = Math.max(0, allowance - used - reserved);

  const configured = hasModelKey() && hasResearchKey();

  const { counts, commitments, signals, debriefCandidates } = board;

  const metrics: Metric[] = [
    {
      label: "Accounts on patch",
      value: String(counts.patch),
      // "+8 this week" against a patch of 8 is not growth, it is the whole
      // list restating itself, which is exactly what a freshly seeded or
      // freshly imported workspace looks like. A delta only means anything
      // when there is a before, so it appears only when some of the patch is
      // older than the window.
      delta:
        counts.patchNew > 0 && counts.patchNew < counts.patch
          ? `+${counts.patchNew} this week`
          : undefined,
      tone: "good",
    },
    { label: "Roles live", value: String(counts.rolesLive) },
    {
      label: "Gone quiet",
      value: String(counts.quiet),
      delta: counts.quiet > 0 ? "90 days+" : undefined,
      tone: counts.quiet > 0 ? "warn" : undefined,
    },
    // Nothing in Pulse tracks hours, so this tile carries no number. A
    // plausible figure here would end up in a screenshot and then in a pitch.
    { label: "BD time", value: "--", pending: true },
  ];

  // Each domain says what the strategist can actually see. "Unknown" is a real state and
  // reads as one: the strategist has not been told, so it does not pretend
  // to a view.
  const has = (kind: string) => memories.some((memory) => memory.kind === kind);
  const domains: Domain[] = [
    {
      key: "patch",
      label: "Your patch",
      read:
        counts.patch > 0
          ? `${counts.patch} accounts, ${counts.quiet} gone quiet`
          : `No Dream 100 yet. Add accounts and ${agent.pronoun} starts watching.`,
      tone: counts.patch === 0 ? "unknown" : counts.quiet > 0 ? "watch" : "good",
    },
    {
      key: "offer",
      label: "Your offer",
      read: has("offer")
        ? "He knows how you charge."
        : "No price anchor. Weakest link right now.",
      tone: has("offer") ? "good" : "warn",
    },
    {
      key: "ideal_client",
      label: "Who you win",
      read: has("ideal_client")
        ? "He knows who you are best for."
        : "Not told yet, so his targeting is generic.",
      tone: has("ideal_client") ? "good" : "watch",
    },
    {
      key: "coaching",
      label: "How you work",
      read: memories.some((memory) => memory.source === "feedback")
        ? "Learning from the answers you rate."
        : "Rate an answer and he adjusts.",
      tone: memories.some((memory) => memory.source === "feedback")
        ? "good"
        : "unknown",
    },
  ];

  const lastAnswer = [...messages]
    .reverse()
    .find((message) => message.role === "assistant");

  // One clock reading for the whole render, taken before any JSX. The ledger
  // ages and the greeting are then computed against the same instant, and
  // nothing impure runs during render.
  const renderedAt = new Date();
  const nowMs = renderedAt.getTime();

  // London, because that is the working day Pulse is built around, and it is
  // resolved here so the greeting cannot flip between server and client.
  const serverHour = Number(
    new Intl.DateTimeFormat("en-GB", {
      hour: "numeric",
      hour12: false,
      timeZone: "Europe/London",
    }).format(renderedAt),
  );

  // The session carries an email, not a display name. The local part before
  // any dot or plus is the closest true thing to a first name, and it falls
  // back to "there" rather than greeting somebody by their email address.
  const local = session.email.split("@")[0]?.split(/[.+_-]/)[0] ?? "";
  const firstName = local
    ? local.charAt(0).toUpperCase() + local.slice(1).toLowerCase()
    : "there";

  return (
    <MaraStage
      messages={messages}
      memories={memories}
      feedbackByAnswer={feedbackByAnswer}
      commitments={commitments}
      signals={signals}
      metrics={metrics}
      domains={domains}
      firstName={firstName}
      serverHour={serverHour}
      // From 17:00 London, and only for a promise made before today's
      // afternoon: asking at 5pm about something committed at 4:55pm is not a
      // debrief, it is nagging. Commitments come oldest first, so [0] is the
      // one that has been outstanding longest.
      debriefDue={
        serverHour >= 17 &&
        debriefCandidates[0] &&
        nowMs - new Date(debriefCandidates[0].said_at).getTime() > 3 * 3_600_000
          ? debriefCandidates[0]
          : null
      }
      nowMs={nowMs}
      lastRead={humanise(lastAnswer?.created_at ?? null, nowMs)}
      // Agency strategy is shared by everyone, so changing it is an
      // organisation-level act. Personal coaching is always the author's.
      canManageAgency={session.role === "owner" || session.role === "admin"}
      meId={session.userId}
      available={available}
      allowance={allowance}
      resetsAt={credits?.resets_at ?? null}
      configured={configured}
      unconfiguredReason={
        hasModelKey()
          ? `Pulse has no research provider configured yet, so ${agent.name} cannot check anything. This is a Pulse setup step, not something you need to do.`
          : `Pulse has no model configured yet, so ${agent.name} cannot answer. This is a Pulse setup step, not something you need to do.`
      }
      // A question handed over in the URL, asked once on arrival.
      pendingQuestion={params.q ?? null}
      openMemory={params.memory === "1"}
      conversations={conversations}
      activeConversationId={activeConversationId}
      todayKey={renderedAt.toISOString().slice(0, 10)}
      yesterdayKey={new Date(nowMs - 86_400_000).toISOString().slice(0, 10)}
    />
  );
}
