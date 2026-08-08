import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ProviderError, streamCompletion } from "@/lib/server/ai/openai";
import { creditCost, EMPTY_USAGE, type Usage } from "@/lib/server/ai/pricing";
import type { Shape, VoiceProfile } from "@/lib/supabase/types";

/**
 * Worth posting about.
 *
 * The Figma's right rail. It reads the recruiter's own workspace, asks the
 * model which of those rows are worth a post, and files the survivors.
 *
 * THE GROUNDING RULE IS THE WHOLE DESIGN.
 *
 * The model never gets to invent a topic. It is handed a numbered list of rows
 * this workspace actually holds, and every suggestion it returns must name the
 * `ref` of one of them. Anything naming a ref that was not in the input is
 * dropped before it reaches the database. That check runs in `groundedOnly`
 * below, not in the prompt: a prompt is a request and a filter is a guarantee,
 * and AI.md section 5 already learned this lesson once on MARKET.
 *
 * A workspace with nothing new produces zero suggestions and says so. It does
 * not produce a generic "post about your expertise", because that is the
 * fabrication rule broken on the most persuasive surface in the product.
 */

export type SourceRow = {
  ref: string;
  kind: "job" | "candidacy" | "placement" | "company" | "signal" | "lesson";
  id: string;
  /** What the model is allowed to know about this row. */
  summary: string;
};

export type Suggestion = {
  source_kind: SourceRow["kind"];
  source_id: string;
  title: string;
  why: string;
  shape_key: string;
};

/** A suppression already in force, as the gatherer filters against it. */
export type Suppression = {
  scope: "source" | "source_shape" | "tone";
  source_id: string | null;
  shape_key: string;
};

/**
 * Collect what is genuinely new in this workspace.
 *
 * Deliberately narrow. Every kind here is a row a recruiter would recognise and
 * could check, which is what makes a suggestion answerable rather than
 * flattering. Anything already suppressed is filtered out before the model is
 * asked, so a declined topic costs nothing to keep declining.
 */
export async function gatherSources(
  supabase: SupabaseClient,
  suppressions: Suppression[],
): Promise<SourceRow[]> {
  const since = new Date(Date.now() - 21 * 86_400_000).toISOString();

  const [jobs, companies, signals, lessons] = await Promise.all([
    supabase
      .from("jobs")
      .select("id, ref, title, state, talent_pool, hired, target")
      .eq("state", "open")
      .limit(20),
    supabase
      .from("companies")
      .select("id, name, type, headcount, location")
      .eq("type", "client")
      .limit(20),
    supabase
      .from("signals")
      .select("id, kind, headline, detail, detected_at")
      .is("dismissed_at", null)
      .gte("detected_at", since)
      .limit(20),
    supabase
      .from("persona_lessons")
      .select("id, lesson, created_at")
      .not("applied_at", "is", null)
      .limit(10),
  ]);

  const rows: SourceRow[] = [];
  let n = 0;
  const ref = () => `S${++n}`;

  for (const j of (jobs.data ?? []) as {
    id: string;
    title: string;
    talent_pool: string;
    hired: number;
    target: number;
  }[]) {
    rows.push({
      ref: ref(),
      kind: "job",
      id: j.id,
      summary: `Open role: ${j.title}. Pool ${j.talent_pool}. ${j.hired} of ${j.target} placed.`,
    });
  }

  for (const c of (companies.data ?? []) as {
    id: string;
    name: string;
    headcount: string;
    location: string;
  }[]) {
    rows.push({
      ref: ref(),
      kind: "company",
      id: c.id,
      summary: `Client: ${c.name}. ${c.headcount} people, ${c.location}.`,
    });
  }

  for (const s of (signals.data ?? []) as {
    id: string;
    kind: string;
    headline: string;
    detail: string;
  }[]) {
    rows.push({
      ref: ref(),
      kind: "signal",
      id: s.id,
      summary: `Signal (${s.kind}): ${s.headline}. ${s.detail}`,
    });
  }

  for (const l of (lessons.data ?? []) as { id: string; lesson: string }[]) {
    rows.push({
      ref: ref(),
      kind: "lesson",
      id: l.id,
      summary: `Something your voice learned: ${l.lesson}`,
    });
  }

  // Drop anything already declined. A source suppressed under one skill stays
  // eligible under another, which is the whole point of `wrong_skill`.
  const blockedSources = new Set(
    suppressions.filter((s) => s.scope === "source").map((s) => s.source_id),
  );

  return rows.filter((r) => !blockedSources.has(r.id));
}

/**
 * Ask which rows are worth a post.
 *
 * Returns raw model output. Nothing here is trusted: `groundedOnly` is what
 * decides which of these survive.
 */
export async function proposeSuggestions(input: {
  sources: SourceRow[];
  shapes: Shape[];
  profile: VoiceProfile | null;
  toneSuppressed: boolean;
  signal?: AbortSignal;
}) {
  const catalogue = input.sources
    .map((s) => `${s.ref}. [${s.kind}] ${s.summary}`)
    .join("\n");

  const skills = input.shapes
    .map((s) => `${s.key}: ${s.name}. ${s.blurb}`)
    .join("\n");

  const system = [
    "You suggest LinkedIn posts for a recruitment agency.",
    "",
    "You are given a numbered list of rows from this recruiter's own workspace.",
    "Every suggestion you make MUST cite the ref of exactly one row. You may",
    "not suggest a topic that is not grounded in one of these rows, and you may",
    "not combine two rows into one suggestion.",
    "",
    "Suggest at most five. Fewer is correct when fewer are genuinely worth it:",
    "returning three good ones beats padding to five. If none of the rows are",
    "worth a post, return an empty list.",
    "",
    "`why` is one sentence saying what makes this worth posting, in terms of",
    "the row. Never flattery, never a generic claim about thought leadership.",
    input.toneSuppressed
      ? "This recruiter has told you your suggestions were too salesy. Avoid promotional framing entirely."
      : "",
    "",
    "Available skills, pick the one that fits:",
    skills,
    input.profile?.summary ? `\nTheir voice: ${input.profile.summary}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const usage: Usage = { ...EMPTY_USAGE };

  const result = await streamCompletion({
    signal: input.signal,
    maxOutputTokens: 900,
    messages: [
      {
        role: "system",
        content: [
          system,
          "",
          'Return ONLY a JSON object: {"suggestions":[{"ref":"S1","title":"...","why":"...","shape_key":"..."}]}',
          "No prose around it.",
        ].join("\n"),
      },
      { role: "user", content: `Rows in this workspace:\n\n${catalogue}` },
    ],
  });

  usage.inputTokens += result.inputTokens;
  usage.outputTokens += result.outputTokens;

  let parsed: { suggestions?: (Suggestion & { ref?: string })[] };
  try {
    const cleaned = result.content
      .trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/, "");
    parsed = JSON.parse(cleaned) as typeof parsed;
  } catch {
    // Same handling as buildShape: unreadable output is a failed run that
    // refunds, never a silently empty rail that looks like "nothing to say".
    throw new ProviderError(
      "The suggestions came back in a form we could not read. Nothing was saved and nothing was charged. Try again.",
      true,
    );
  }

  return {
    proposed: parsed.suggestions ?? [],
    usage,
    credits: creditCost(usage),
    meta: {
      kind: "suggestions",
      sourcesOffered: input.sources.length,
      returned: (parsed.suggestions ?? []).length,
    },
  };
}

/**
 * Keep only the suggestions that name a row we actually sent.
 *
 * This is the guarantee the prompt cannot give. A model asked to cite its
 * source will usually do it and will occasionally invent one that looks
 * plausible, and a plausible invented source is worse than an obvious one
 * because nobody checks it.
 *
 * Also dedupes: one row is worth one suggestion per run, so a model that
 * returns the same job twice under two framings contributes once.
 */
export function groundedOnly(
  proposed: (Suggestion & { ref?: string })[],
  sources: SourceRow[],
  shapes: Shape[],
): Suggestion[] {
  const byRef = new Map(sources.map((s) => [s.ref, s]));
  const validShapes = new Set(shapes.map((s) => s.key));
  const seen = new Set<string>();
  const kept: Suggestion[] = [];

  for (const item of proposed ?? []) {
    const source = item.ref ? byRef.get(item.ref) : undefined;
    if (!source) continue;
    if (!item.title?.trim() || !item.why?.trim()) continue;
    if (!validShapes.has(item.shape_key)) continue;

    const key = `${source.id}:${item.shape_key}`;
    if (seen.has(key)) continue;
    seen.add(key);

    kept.push({
      // The kind and id come from OUR row, never from the model's echo of it.
      source_kind: source.kind,
      source_id: source.id,
      title: item.title.trim(),
      why: item.why.trim(),
      shape_key: item.shape_key,
    });
  }

  return kept;
}
