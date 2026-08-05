import "server-only";

import type { createClient } from "@/lib/supabase/server";
import type { BDAgentMemoryRow } from "@/lib/supabase/types";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** The only BD memories a signed-in recruiter can see and ask with. */
export async function loadBDAgentMemories(
  supabase: Supabase,
  orgId: string,
  userId: string,
): Promise<BDAgentMemoryRow[]> {
  const [agency, personal] = await Promise.all([
    supabase
      .from("bd_agent_memories")
      .select("*")
      .eq("org_id", orgId)
      .eq("scope", "agency")
      .order("updated_at", { ascending: false }),
    supabase
      .from("bd_agent_memories")
      .select("*")
      .eq("org_id", orgId)
      .eq("scope", "personal")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false }),
  ]);

  return [
    ...((agency.data ?? []) as BDAgentMemoryRow[]),
    ...((personal.data ?? []) as BDAgentMemoryRow[]),
  ];
}

/**
 * Memory makes coaching relevant, but it must never act as evidence of a market
 * fact. This compact labelled form is deliberately the only shape the model
 * receives, so database metadata cannot leak into a prompt or waste credits.
 */
export function memoryForPrompt(memories: BDAgentMemoryRow[]): string[] {
  return memories
    .filter(
      (memory) =>
        memory.title.trim().length > 0 && memory.body.trim().length > 0,
    )
    .slice(0, 18)
    .map(
      (memory) =>
        `[${memory.scope === "agency" ? "Agency strategy" : "Recruiter coaching"}: ${memory.kind}] ${memory.title.trim().slice(0, 80)}: ${memory.body.trim().slice(0, 500)}`,
    );
}
