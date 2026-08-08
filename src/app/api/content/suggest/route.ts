import { NextResponse } from "next/server";
import { sessionOrNull } from "@/lib/auth";
import { hasModelKey, ProviderError } from "@/lib/server/ai/openai";
import { SURFACE_LIMITS } from "@/lib/server/ai/pricing";
import {
  gatherSources,
  groundedOnly,
  proposeSuggestions,
  type Suppression,
} from "@/lib/server/ai/suggestions";
import { allShapes } from "@/lib/shapes";
import { createClient } from "@/lib/supabase/server";
import type { ContentShapeRow, PersonaRow } from "@/lib/supabase/types";

// PLS-162. Worth posting about.
//
// The same credit contract as every other paid call: reserve before the
// provider, settle at the metered cost after, refund in full on failure, and
// let the ten minute sweep catch anything this process never finished.
//
// On demand only, never a cron. A background job spending a customer's weekly
// allowance on suggestions they did not ask for is exactly what the credit
// rules exist to prevent, and it would be the one paid call in the product
// that a recruiter never chose to make.
//
// Not streamed. A draft is streamed because watching it write is the point; a
// list of five short suggestions has nothing worth watching arrive, so this is
// a plain JSON response and the rail shows a loading state.

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST() {
  const session = await sessionOrNull();
  if (!session) {
    return NextResponse.json(
      { error: "Sign in to see what is worth posting about." },
      { status: 401 },
    );
  }

  if (!hasModelKey()) {
    // Said before anything is reserved, per AI.md section 4.
    return NextResponse.json(
      {
        error:
          "Suggestions are not switched on for this deployment yet, so nothing was read and nothing was charged.",
      },
      { status: 503 },
    );
  }

  const supabase = await createClient();

  const [{ data: suppressionRows }, { data: shapeRows }, { data: personaRow }] =
    await Promise.all([
      supabase
        .from("content_suggestion_suppressions")
        .select("scope, source_id, shape_key, until")
        .or(`until.is.null,until.gt.${new Date().toISOString()}`),
      supabase.from("content_shapes").select("*").order("sort"),
      supabase.from("content_personas").select("*").maybeSingle(),
    ]);

  const suppressions = (suppressionRows ?? []) as Suppression[];
  const shapes = allShapes((shapeRows ?? []) as ContentShapeRow[]);
  const persona = (personaRow ?? null) as PersonaRow | null;

  const sources = await gatherSources(supabase, suppressions);

  // Nothing to ground a suggestion in. This is a real answer, not a failure,
  // and it costs nothing: no reservation, no provider call. The rail says what
  // would fill it rather than inventing something to show.
  if (sources.length === 0) {
    return NextResponse.json({
      suggestions: 0,
      reason:
        "Nothing new in your pipeline to post about yet. Open roles, client companies and recent signals are what this reads.",
    });
  }

  const limits = SURFACE_LIMITS.contentSuggest;

  // Law 3, and AI.md section 3. The reservation lands before the provider is
  // called, so a crash between here and the answer costs the org its
  // reservation and nothing more, and the sweep gives that back.
  const { data: claim, error: claimError } = await supabase.rpc("begin_ask", {
    target_org: session.org.id,
    target_surface: "content",
    question: "What is worth posting about?",
    reserve: limits.reserveCredits,
  });
  if (claimError) {
    return NextResponse.json({ error: claimError.message }, { status: 400 });
  }
  if (!claim) {
    return NextResponse.json(
      {
        error:
          "Your weekly allowance is spent, so nothing was read. It resets at the start of your next week.",
      },
      { status: 402 },
    );
  }

  const messageId = claim as string;

  try {
    const outcome = await proposeSuggestions({
      sources,
      shapes,
      profile: persona?.voice_profile ?? null,
      toneSuppressed: suppressions.some((s) => s.scope === "tone"),
    });

    // The guarantee the prompt cannot give: anything naming a row we did not
    // send is dropped here, before it reaches the database.
    const kept = groundedOnly(outcome.proposed, sources, shapes);

    if (kept.length > 0) {
      // Law 2: the partial unique index is the race guard, so a second run that
      // rediscovers the same row absorbs the conflict rather than erroring.
      const { error: insertError } = await supabase
        .from("content_suggestions")
        .upsert(
          kept.map((s) => ({
            org_id: session.org.id,
            user_id: session.userId,
            source_kind: s.source_kind,
            source_id: s.source_id,
            title: s.title,
            why: s.why,
            shape_key: s.shape_key,
            run_id: messageId,
          })),
          { onConflict: "user_id,source_kind,source_id,shape_key", ignoreDuplicates: true },
        );

      if (insertError) {
        // The run happened and cost real money, so it settles at cost. The
        // failure is reported rather than swallowed into an empty rail.
        await supabase.rpc("finish_ask", {
          message: messageId,
          answer_body: "",
          answer_sources: [],
          actual_cost: outcome.credits,
          run_status: "failed",
          answer_meta: outcome.meta,
          error_text: insertError.message,
        });
        return NextResponse.json({ error: insertError.message }, { status: 500 });
      }
    }

    await supabase.rpc("finish_ask", {
      message: messageId,
      answer_body: `${kept.length} suggestions`,
      answer_sources: [],
      actual_cost: outcome.credits,
      run_status: "complete",
      answer_meta: { ...outcome.meta, kept: kept.length },
    });

    // Honest counts, law 9. `dropped` is the number the model returned that did
    // not trace to a row we sent, and it being non-zero is worth knowing.
    return NextResponse.json({
      suggestions: kept.length,
      dropped: outcome.proposed.length - kept.length,
      credits: outcome.credits,
    });
  } catch (error) {
    const message =
      error instanceof ProviderError
        ? error.message
        : error instanceof Error
          ? error.message
          : "The suggestions could not be built.";

    // Refund in full: the provider failed, so the org keeps its credits.
    await supabase.rpc("finish_ask", {
      message: messageId,
      answer_body: "",
      answer_sources: [],
      actual_cost: 0,
      run_status: "failed",
      answer_meta: {},
      error_text: message,
    });

    return NextResponse.json({ error: message }, { status: 502 });
  }
}
