import { NextResponse } from "next/server";
import { sessionOrNull } from "@/lib/auth";
import { encodeEvent, type AskEvent } from "@/lib/ai-events";
import { generatePost } from "@/lib/server/ai/content";
import { hasModelKey, ProviderError } from "@/lib/server/ai/openai";
import { SURFACE_LIMITS } from "@/lib/server/ai/pricing";
import { createClient } from "@/lib/supabase/server";
import { allShapes, shapeFromValue } from "@/lib/shapes";
import type {
  ContentShapeRow,
  PersonaRow,
  VoiceProfile,
} from "@/lib/supabase/types";

// PLS-83. Write a post in the caller's own voice.
//
// Modelled on /api/ask down to the wire format, because the credit contract is
// the same one: reserve before the provider call, settle at the metered cost
// after it, refund in full on failure, and let the ten minute sweep catch
// anything this process never got to finish. Reusing AskEvent means the client
// reuses decodeEvents rather than inventing a second protocol.

export const runtime = "nodejs";
// Longer than the slowest draft we allow, shorter than the sweep that refunds
// a run this limit kills.
export const maxDuration = 60;

export async function POST(request: Request) {
  const session = await sessionOrNull();
  if (!session) {
    return NextResponse.json(
      { error: "Sign in to write a post." },
      { status: 401 },
    );
  }

  if (!hasModelKey()) {
    // Say so before taking the question, never after. AI.md section 4.
    return NextResponse.json(
      {
        error:
          "Post generation is not switched on for this deployment yet, so nothing was written and nothing was charged.",
      },
      { status: 503 },
    );
  }

  let payload: { idea?: unknown; shape?: unknown };
  try {
    payload = (await request.json()) as { idea?: unknown; shape?: unknown };
  } catch {
    return NextResponse.json({ error: "Body was not json." }, { status: 400 });
  }

  const idea = typeof payload.idea === "string" ? payload.idea.trim() : "";
  const shapeValue = typeof payload.shape === "string" ? payload.shape : "";

  if (!idea) {
    return NextResponse.json(
      { error: "Describe the post you want first." },
      { status: 400 },
    );
  }
  if (idea.length > 2000) {
    return NextResponse.json(
      { error: "That description is too long. Trim it to the essentials." },
      { status: 400 },
    );
  }

  const supabase = await createClient();

  // Everything above the claim is free; nothing below it runs without the
  // credits already banked.
  const [{ data: shapeRows }, { data: personaRow }] = await Promise.all([
    supabase.from("content_shapes").select("*").order("sort"),
    supabase
      .from("content_personas")
      .select("*")
      .eq("user_id", session.userId)
      .maybeSingle(),
  ]);

  const shape = shapeFromValue(
    shapeValue,
    allShapes((shapeRows ?? []) as ContentShapeRow[]),
  );
  if (!shape) {
    return NextResponse.json(
      { error: "That shape no longer exists. Pick another." },
      { status: 400 },
    );
  }

  const persona = (personaRow ?? null) as PersonaRow | null;
  const profile = (persona?.voice_profile ?? {}) as VoiceProfile;

  // A draft written with no persona is a generic draft, and pretending
  // otherwise is how someone concludes the feature does not work.
  if (!profile.summary) {
    return NextResponse.json(
      {
        error:
          "Build your persona first, or every post will come back in nobody's voice. It takes a minute.",
      },
      { status: 409 },
    );
  }

  // Lessons the user reviewed and kept are already folded into the profile.
  // The pending ones are deliberately not used here: an unreviewed lesson
  // changing the output is the silent drift this design rules out.
  const limits = SURFACE_LIMITS.content;
  const { data: claim, error: claimError } = await supabase.rpc("begin_ask", {
    target_org: session.org.id,
    target_surface: "content",
    question: idea,
    reserve: limits.reserveCredits,
  });
  if (claimError) {
    return NextResponse.json({ error: claimError.message }, { status: 400 });
  }
  if (!claim) {
    return NextResponse.json(
      {
        error:
          "Your credit allowance for this week is spent, so nothing was written and nothing was charged.",
      },
      { status: 402 },
    );
  }

  const { message_id: messageId, reserved } = claim as {
    message_id: string;
    reserved: number;
  };

  const encoder = new TextEncoder();
  const abort = new AbortController();
  request.signal.addEventListener("abort", () => abort.abort());

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: AskEvent) =>
        controller.enqueue(encoder.encode(encodeEvent(event)));

      try {
        send({ type: "opened", messageId, reserved });
        send({ type: "phase", phase: "writing" });

        const outcome = await generatePost({
          idea,
          shape,
          profile,
          signal: abort.signal,
          onDelta: (text) => send({ type: "delta", text }),
        });

        send({ type: "phase", phase: "settling" });

        const { error: settleError } = await supabase.rpc("finish_ask", {
          message: messageId,
          answer_body: outcome.body,
          answer_sources: [],
          actual_cost: outcome.credits,
          run_status: "complete",
          answer_meta: outcome.meta,
          error_text: null,
        });

        if (settleError) {
          // The draft exists but the ledger did not move. Say so rather than
          // finishing clean: the sweep will release the reservation.
          send({
            type: "error",
            message: `The post was written but the credit ledger did not update: ${settleError.message}`,
            retryable: false,
          });
          return;
        }

        const { data: ledger } = await supabase
          .from("credit_ledger")
          .select("*")
          .maybeSingle();

        send({
          type: "done",
          messageId,
          creditsSpent: outcome.credits,
          creditsRefunded: Math.max(0, reserved - outcome.credits),
          availableAfter: ledger
            ? ledger.weekly_allowance -
              ledger.used_this_week -
              ledger.reserved_this_week
            : 0,
        });
      } catch (error) {
        const retryable =
          error instanceof ProviderError ? error.retryable : true;
        const message =
          error instanceof ProviderError
            ? error.message
            : "The draft stopped before it finished. Nothing was charged.";

        await supabase.rpc("finish_ask", {
          message: messageId,
          answer_body: "",
          answer_sources: [],
          actual_cost: 0,
          run_status: "failed",
          answer_meta: {},
          error_text: message,
        });

        send({ type: "error", message, retryable });
      } finally {
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
