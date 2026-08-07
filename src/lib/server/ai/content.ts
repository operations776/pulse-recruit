import "server-only";
import { streamCompletion, ProviderError } from "@/lib/server/ai/openai";
import { creditCost, type Usage } from "@/lib/server/ai/pricing";
import type { Shape, VoiceProfile } from "@/lib/supabase/types";

// Pillar 5 generation. Two calls, both toolless: distil a persona from what a
// recruiter pasted, and write a post from that persona plus a shape.
//
// This deliberately does not go through run.ts. That loop exists to let a model
// decide which tools to call and to refuse an ungrounded MARKET answer; there
// are no tools here and nothing to ground against, so a loop would be
// ceremony. What it DOES share is everything that matters for money:
// streamCompletion, the Usage shape, and creditCost, so a generated post is
// metered by the same arithmetic as every other provider call.

export type ContentOutcome = {
  usage: Usage;
  credits: number;
  meta: Record<string, unknown>;
};

const empty = (): Usage => ({
  inputTokens: 0,
  outputTokens: 0,
  searches: 0,
  pageReads: 0,
});

/** Trim and cap a pasted sample so one giant paste cannot swamp the context. */
function sample(text: string, max = 1200): string {
  const trimmed = text.trim();
  return trimmed.length > max ? `${trimmed.slice(0, max)}...` : trimmed;
}

/**
 * Read a voice out of what someone pasted.
 *
 * The flops matter as much as the wins. What a person rejects defines a voice
 * as sharply as what they are proud of, and a model given only good examples
 * will flatten everyone into the same competent LinkedIn hum.
 */
export async function buildVoiceProfile(input: {
  headline: string;
  about: string;
  proudPosts: string[];
  flopPosts: string[];
  signal?: AbortSignal;
}): Promise<{ profile: VoiceProfile } & ContentOutcome> {
  const proud = input.proudPosts.filter((p) => p.trim()).map((p) => sample(p));
  const flop = input.flopPosts.filter((p) => p.trim()).map((p) => sample(p));

  if (proud.length === 0 && !input.about.trim() && !input.headline.trim()) {
    throw new ProviderError(
      "There is nothing to read a voice from yet. Paste your headline, your About, or a post you were proud of.",
      false,
    );
  }

  const parts = [
    input.headline.trim() ? `HEADLINE\n${sample(input.headline, 300)}` : "",
    input.about.trim() ? `ABOUT\n${sample(input.about, 1500)}` : "",
    proud.length
      ? `POSTS THEY WERE PROUD OF\n${proud.map((p, i) => `${i + 1}. ${p}`).join("\n\n")}`
      : "",
    flop.length
      ? `POSTS THAT FLOPPED\n${flop.map((p, i) => `${i + 1}. ${p}`).join("\n\n")}`
      : "",
  ].filter(Boolean);

  const usage = empty();

  const result = await streamCompletion({
    signal: input.signal,
    maxOutputTokens: 700,
    messages: [
      {
        role: "system",
        content: [
          "You read a person's writing and describe how they actually sound, so another writer could imitate them convincingly.",
          "",
          "Return ONLY a JSON object, no prose around it, with these keys:",
          '  summary: one or two sentences describing the voice, addressed to them as "You ...".',
          "  tone: 3 to 5 short adjectives.",
          "  openings: 2 to 4 ways they typically start a post, described concretely.",
          "  rhythm: one sentence on sentence length and paragraphing.",
          "  banned: 3 to 6 words, phrases or habits they clearly avoid, or that made the flops flop.",
          "  proof: 2 to 5 recurring specifics they reach for, such as numbers, roles, places, or named situations.",
          "",
          "Be specific and evidence-led. 'Direct and professional' is useless; 'opens with a number, never a greeting' is useful.",
          "If the flops differ from the wins, the difference is your strongest evidence: say what it tells you.",
          "Never invent a detail that is not visible in the material.",
        ].join("\n"),
      },
      { role: "user", content: parts.join("\n\n") },
    ],
  });

  usage.inputTokens += result.inputTokens;
  usage.outputTokens += result.outputTokens;

  let profile: VoiceProfile;
  try {
    // The model is told to return bare JSON, but a fenced block is the most
    // common deviation and is cheap to survive.
    const cleaned = result.content
      .trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/, "");
    profile = JSON.parse(cleaned) as VoiceProfile;
  } catch {
    // Retryable: a malformed profile is a bad roll, not a broken config, and
    // the reservation is refunded either way.
    throw new ProviderError(
      "The persona came back in a shape we could not read. Nothing was saved. Try again.",
      true,
    );
  }

  if (!profile.summary?.trim()) {
    throw new ProviderError(
      "The persona came back empty, so nothing was saved. Try adding another post you were proud of.",
      true,
    );
  }

  return {
    profile,
    usage,
    credits: creditCost(usage),
    meta: {
      kind: "persona",
      input_tokens: usage.inputTokens,
      output_tokens: usage.outputTokens,
      proud: proud.length,
      flops: flop.length,
    },
  };
}

/**
 * Write a post: the persona says how it sounds, the shape says what it does,
 * the idea says what it is about.
 */
export async function generatePost(input: {
  idea: string;
  shape: Shape;
  profile: VoiceProfile;
  lessons?: string[];
  /**
   * PLS-187, the editor's rewrite toolbar. When present the model revises
   * this text under the instruction instead of drafting from an idea. Same
   * voice, same shape, same metering; the one extra rule is that a revision
   * may not introduce facts the original does not contain.
   */
  rewrite?: { body: string; instruction: string };
  signal?: AbortSignal;
  onDelta?: (text: string) => void;
}): Promise<{ body: string } & ContentOutcome> {
  const voice = [
    input.profile.summary ? `HOW THEY SOUND\n${input.profile.summary}` : "",
    input.profile.tone?.length ? `TONE: ${input.profile.tone.join(", ")}` : "",
    input.profile.openings?.length
      ? `HOW THEY OPEN\n${input.profile.openings.map((o) => `- ${o}`).join("\n")}`
      : "",
    input.profile.rhythm ? `RHYTHM: ${input.profile.rhythm}` : "",
    input.profile.banned?.length
      ? `NEVER USE: ${input.profile.banned.join(", ")}`
      : "",
    input.profile.proof?.length
      ? `THEY REACH FOR\n${input.profile.proof.map((p) => `- ${p}`).join("\n")}`
      : "",
    input.lessons?.length
      ? `LEARNED FROM THEIR EDITS\n${input.lessons.map((l) => `- ${l}`).join("\n")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const usage = empty();

  const result = await streamCompletion({
    signal: input.signal,
    onDelta: input.onDelta,
    maxOutputTokens: 900,
    messages: [
      {
        role: "system",
        content: [
          "You write a LinkedIn post as the person described below. Not about them: as them.",
          "",
          voice || "No voice profile is available. Write plainly and specifically.",
          "",
          "THE SHAPE THIS POST TAKES",
          input.shape.prompt,
          "",
          "Rules:",
          "- Return the post text only. No preamble, no title, no hashtags unless their voice uses them, no markdown.",
          "- Match their rhythm and their openings. If they never greet, do not greet.",
          "- Specific beats clever. Use their real details from the idea; invent nothing.",
          "- If the idea is too thin to write honestly, say what is missing in one line instead of padding it out.",
          "- Under 200 words unless their own posts run longer.",
          ...(input.rewrite
            ? [
                "",
                "This is a REVISION. Apply the instruction to the post you are given, keep everything else, and never add a fact the original does not contain.",
              ]
            : []),
        ].join("\n"),
      },
      {
        role: "user",
        content: input.rewrite
          ? `REWRITE THIS POST\n${input.rewrite.body.trim()}\n\nINSTRUCTION\n${input.rewrite.instruction.trim()}`
          : input.idea.trim(),
      },
    ],
  });

  usage.inputTokens += result.inputTokens;
  usage.outputTokens += result.outputTokens;

  const body = result.content.trim();
  if (!body) {
    throw new ProviderError(
      "The draft came back empty, so nothing was written. Nothing was charged beyond the tokens it used. Try describing the idea in another sentence.",
      true,
    );
  }

  return {
    body,
    usage,
    credits: creditCost(usage),
    meta: {
      kind: "post",
      shape: input.shape.key,
      input_tokens: usage.inputTokens,
      output_tokens: usage.outputTokens,
      truncated: result.truncated,
    },
  };
}

/**
 * Turn a sentence describing a kind of post into a reusable shape.
 *
 * The output has to match the five built-ins in `content-skills.ts`, because
 * `generatePost` feeds a shape's prompt straight into the system message and a
 * frame in a different format produces a differently-shaped post. Three beats,
 * each a label and one instruction, is the contract.
 */
export async function buildShape(input: {
  description: string;
  signal?: AbortSignal;
}): Promise<{ shape: { name: string; blurb: string; prompt: string } } & ContentOutcome> {
  const description = input.description.trim();
  if (!description) {
    throw new ProviderError("Describe the kind of post first.", false);
  }

  const usage = empty();

  const result = await streamCompletion({
    signal: input.signal,
    maxOutputTokens: 500,
    messages: [
      {
        role: "system",
        content: [
          "You design reusable frames for LinkedIn posts. A frame is not a template with blanks: it is three instructions that tell a writer what each part of the post has to do.",
          "",
          "Return ONLY a JSON object, no prose around it:",
          "  name: 2 to 4 words, plain and concrete. What a recruiter would call this kind of post.",
          "  blurb: one sentence starting 'Use when', describing the moment this post is right for.",
          "  prompt: exactly three lines separated by newlines. Each line is 'Label: one instruction.'",
          "",
          "The three beats must move: a setup, a turn, and a landing. Never three restatements of the topic.",
          "Instructions must be specific enough to act on. 'Talk about the role' is useless; 'the city, the working pattern, and the top of the band, no coy salary' is useful.",
          "",
          "Here are two existing frames, for format and register:",
          "",
          "Hook: the role, the city, the working pattern, and the top of the band. No coy salary.",
          "Edge: the one thing about this job a candidate cannot get at the obvious competitor.",
          "Ask: invite a reply, not an application. A comment or a DM is enough to start.",
          "",
          "Moment: one specific thing that happened this week, with the detail that makes it real.",
          "Cost: what it actually cost you. A placement, a client, a weekend.",
          "Change: the rule you now work by because of it.",
        ].join("\n"),
      },
      { role: "user", content: description },
    ],
  });

  usage.inputTokens += result.inputTokens;
  usage.outputTokens += result.outputTokens;

  let shape: { name?: string; blurb?: string; prompt?: string };
  try {
    const cleaned = result.content
      .trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/, "");
    shape = JSON.parse(cleaned) as typeof shape;
  } catch {
    throw new ProviderError(
      "The shape came back in a form we could not read. Nothing was saved. Try again.",
      true,
    );
  }

  if (!shape.name?.trim() || !shape.prompt?.trim()) {
    throw new ProviderError(
      "The shape came back incomplete, so nothing was saved. Try describing it in another sentence.",
      true,
    );
  }

  return {
    shape: {
      name: shape.name.trim(),
      blurb: shape.blurb?.trim() ?? "",
      prompt: shape.prompt.trim(),
    },
    usage,
    credits: creditCost(usage),
    meta: {
      kind: "shape",
      input_tokens: usage.inputTokens,
      output_tokens: usage.outputTokens,
    },
  };
}

/**
 * Distil one line from the gap between what was generated and what was
 * published. Returns null when the edit was trivial, so the persona does not
 * fill up with "they fixed a typo".
 */
export async function distilLesson(input: {
  generated: string;
  published: string;
  signal?: AbortSignal;
}): Promise<{ lesson: string | null } & ContentOutcome> {
  const usage = empty();

  const result = await streamCompletion({
    signal: input.signal,
    maxOutputTokens: 120,
    messages: [
      {
        role: "system",
        content: [
          "Two versions of a post: one written by a model, one after the author edited it.",
          "Say in ONE sentence what the edit reveals about how this author wants to sound, phrased as an instruction for next time.",
          'If the change is only typos, formatting or trivial wording, reply with exactly: NOTHING',
        ].join("\n"),
      },
      {
        role: "user",
        content: `GENERATED\n${sample(input.generated, 1500)}\n\nPUBLISHED\n${sample(input.published, 1500)}`,
      },
    ],
  });

  usage.inputTokens += result.inputTokens;
  usage.outputTokens += result.outputTokens;

  const text = result.content.trim();
  const lesson = !text || text.toUpperCase().startsWith("NOTHING") ? null : text;

  return {
    lesson,
    usage,
    credits: creditCost(usage),
    meta: { kind: "lesson", input_tokens: usage.inputTokens, output_tokens: usage.outputTokens },
  };
}
