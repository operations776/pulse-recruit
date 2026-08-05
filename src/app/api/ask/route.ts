import { encodeEvent, type AskEvent } from "@/lib/ai-events";
import { sessionOrNull } from "@/lib/auth";
import { ProviderError } from "@/lib/server/ai/openai";
import { SURFACE_LIMITS } from "@/lib/server/ai/pricing";
import {
  loadBDAgentMemories,
  memoryForPrompt,
} from "@/lib/server/ai/bd-memory";
import { runAsk } from "@/lib/server/ai/run";
import { createClient } from "@/lib/supabase/server";
import type { ChatRow, ChatSurface } from "@/lib/supabase/types";

// AI.md section 7. A research run takes 20 to 60 seconds, so it streams. A
// server action cannot, which is the only reason this is a route handler.

export const runtime = "nodejs";
// Longer than the slowest run we allow, shorter than the 10 minute sweep. A run
// killed by this limit is still refunded, by the sweep.
export const maxDuration = 120;

const SURFACES: ChatSurface[] = ["market", "ops"];

function refuse(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

export async function POST(request: Request) {
  const session = await sessionOrNull();
  if (!session) return refuse("Sign in to ask a question.", 401);

  let payload: { surface?: string; question?: string };
  try {
    payload = await request.json();
  } catch {
    return refuse("The request was not readable.", 400);
  }

  const surface = payload.surface as ChatSurface;
  const question = (payload.question ?? "").trim();

  if (!SURFACES.includes(surface)) return refuse("Unknown surface.", 400);
  if (!question) return refuse("Type a question first.", 400);
  if (question.length > 2000) {
    return refuse("That question is too long. Trim it to 2000 characters.", 400);
  }

  const supabase = await createClient();
  const limits = SURFACE_LIMITS[surface];

  // History for continuity and durable BD context, both read before the claim
  // so a failed read cannot leave a reservation stranded. In parallel: they do
  // not depend on each other and this is on the path to a streamed answer.
  const [priorResult, memories] = await Promise.all([
    supabase
      .from("chat_messages")
      .select("*")
      .eq("surface", surface)
      .order("created_at", { ascending: false })
      .limit(12),
    // MARKET only. The ops manager reads the agency's own rows and has no use
    // for BD positioning, so loading it there would be spend with no effect.
    surface === "market"
      ? loadBDAgentMemories(supabase, session.org.id, session.userId)
      : Promise.resolve([]),
  ]);
  const history = ((priorResult.data ?? []) as ChatRow[]).reverse();
  const memory = memoryForPrompt(memories);

  // Claim. Nothing above this line has cost us anything; nothing below it runs
  // without the credits already banked (ARCHITECTURE.md law 3).
  const { data: claim, error: claimError } = await supabase.rpc("begin_ask", {
    target_org: session.org.id,
    target_surface: surface,
    question,
    reserve: limits.reserveCredits,
  });

  if (claimError) return refuse(claimError.message, 400);
  if (!claim) {
    return refuse(
      "Your research allowance for this week is spent, so this question has not been asked and nothing was charged.",
      402,
    );
  }

  const messageId = (claim as { message_id: string }).message_id;
  const reserved = (claim as { reserved: number }).reserved;

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const send = (event: AskEvent) => {
        if (closed) return;
        controller.enqueue(encoder.encode(encodeEvent(event)));
      };

      // The client going away must not leave the run holding credits, so the
      // abort still runs the settle path below.
      const abort = new AbortController();
      request.signal.addEventListener("abort", () => abort.abort());

      send({ type: "opened", messageId, reserved });

      try {
        const outcome = await runAsk({
          surface,
          question,
          history,
          orgName: session.org.name,
          memory,
          ctx: {
            supabase,
            orgId: session.org.id,
            signal: abort.signal,
            budget: {
              searches: limits.maxSearches,
              pageReads: limits.maxPageReads,
            },
          },
          emit: send,
        });

        send({ type: "phase", phase: "settling" });

        const { data: settled, error: settleError } = await supabase.rpc("finish_ask", {
          message: messageId,
          answer_body: outcome.body,
          answer_sources: outcome.sources,
          actual_cost: outcome.credits,
          run_status: "complete",
          answer_meta: outcome.meta,
          error_text: null,
        });

        if (settleError) {
          // The answer exists but the ledger did not move. Say so rather than
          // reporting a clean finish we did not get (law 9). The sweep will
          // release the reservation.
          send({
            type: "error",
            message:
              "The answer was written but the credit ledger did not update. It has been logged and the reservation will be released.",
            retryable: false,
          });
          return;
        }

        const spent = (settled as { spent?: number })?.spent ?? 0;
        const refunded = (settled as { refunded?: number })?.refunded ?? 0;

        const { data: ledger } = await supabase
          .from("credit_ledger")
          .select("weekly_allowance, used_this_week, reserved_this_week")
          .maybeSingle();

        send({
          type: "done",
          messageId,
          creditsSpent: spent,
          creditsRefunded: refunded,
          availableAfter: ledger
            ? ledger.weekly_allowance - ledger.used_this_week - ledger.reserved_this_week
            : 0,
        });
      } catch (error) {
        const provider = error instanceof ProviderError;
        const message = provider
          ? error.message
          : "The run stopped before it finished. Nothing was charged.";

        // Refund in full and record the real reason on the message, so the
        // transcript shows the failure instead of an empty bubble.
        await supabase.rpc("finish_ask", {
          message: messageId,
          answer_body: "",
          answer_sources: [],
          actual_cost: 0,
          run_status: "failed",
          answer_meta: {},
          error_text: message,
        });

        send({
          type: "error",
          message,
          retryable: provider ? (error as ProviderError).retryable : true,
        });
      } finally {
        closed = true;
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      // Proxies that buffer would defeat the whole point of streaming.
      "x-accel-buffering": "no",
    },
  });
}
