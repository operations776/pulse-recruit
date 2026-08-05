import { getBDWorkspace } from "@/lib/data";
import { hasResearchKey } from "@/lib/server/ai/exa";
import { hasModelKey } from "@/lib/server/ai/openai";
import { StrategistWorkspace } from "./strategist-workspace";

// Pillar 1. The BD Strategist.
//
// It researches with Exa, reasons over what it finds, and remembers the
// strategy and coaching this agency has told it. The answer is only worth as
// much as the sources under it, so every briefing carries them, and a run that
// read nothing fails rather than answering (AI.md section 5).
//
// The page header this screen used to have is gone. It spent ~140px repeating
// what the module rail says and explaining the product to somebody already
// using it. The strategy rail carries the identity now, and the space belongs
// to the work.

export default async function BDStrategistPage() {
  const { session, messages, credits, memories, feedbackByAnswer } =
    await getBDWorkspace();

  const allowance = credits?.weekly_allowance ?? 0;
  const used = credits?.used_this_week ?? 0;
  // Reserved credits belong to a run in flight. Showing them as available is
  // how you promise a question you cannot pay for.
  const reserved = credits?.reserved_this_week ?? 0;
  const available = Math.max(0, allowance - used - reserved);
  const committed = used + reserved;
  const usedPct =
    allowance > 0 ? Math.min(100, Math.round((committed / allowance) * 100)) : 0;

  const configured = hasModelKey() && hasResearchKey();

  return (
    <StrategistWorkspace
      messages={messages}
      memories={memories}
      feedbackByAnswer={feedbackByAnswer}
      // Agency strategy is shared by everyone, so changing it is an
      // organisation-level act. Personal coaching is always the author's.
      canManageAgency={session.role === "owner" || session.role === "admin"}
      meId={session.userId}
      available={available}
      allowance={allowance}
      reserved={reserved}
      resetsAt={credits?.resets_at ?? null}
      usedPct={usedPct}
      configured={configured}
      unconfiguredReason={
        hasModelKey()
          ? "Pulse has no research provider configured yet, so the strategist cannot check anything. This is a Pulse setup step, not something you need to do."
          : "Pulse has no model configured yet, so the strategist cannot answer. This is a Pulse setup step, not something you need to do."
      }
    />
  );
}
