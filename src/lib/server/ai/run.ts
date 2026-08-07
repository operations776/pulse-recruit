import "server-only";
import type { AskEvent } from "@/lib/ai-events";
import type { ChatRow, ChatSource, ChatSurface } from "@/lib/supabase/types";
import { hasResearchKey } from "@/lib/server/ai/exa";
import {
  hasModelKey,
  ProviderError,
  streamCompletion,
  MODEL,
  type ChatMessage,
  type ToolCall,
} from "@/lib/server/ai/openai";
import { EMPTY_USAGE, SURFACE_LIMITS, creditCost, type Usage } from "@/lib/server/ai/pricing";
import { MARKET_TOOLS, OPS_TOOLS, runTool, type ToolContext } from "@/lib/server/ai/tools";

// The agent loop. Both surfaces run through here; the surface decides the tool
// set, the prompt, and the budget, and nothing else about them differs.

export type RunOutcome = {
  body: string;
  sources: ChatSource[];
  usage: Usage;
  credits: number;
  meta: Record<string, unknown>;
};

const HISTORY_TURNS = 6;

function systemPrompt(
  surface: ChatSurface,
  orgName: string,
  today: string,
  memory: string[] = [],
): string {
  if (surface === "market") {
    return [
      `You are Reyhan, the BD strategist inside Pulse. You work for ${orgName}, a recruitment agency. Today is ${today}.`,
      "",
      "You are this agency's business development strategist. You find the opportunity, you say what it means commercially, and you name the single best next move. You are not a search engine and you are not a chatbot.",
      "",
      // The model knows what recruiting is in general. What it does not know
      // without being told is how this business actually earns, and that is
      // what separates a real move from a plausible one: a funding round only
      // matters if it turns into a role, and a role only pays if this agency
      // is the one that fills it.
      "How this business works, so your advice is about money and not about news:",
      "- An agency earns a fee when it places a candidate, usually a percentage of first year salary, usually only on a hire. Research that does not end in a role worth working is not worth a recruiter's morning.",
      "- A signal matters because of the hiring it implies. Funding means headcount. A leader joining means they will build a team. A leader leaving means an open seat and a broken relationship with whoever was serving it. Say which of these you are looking at.",
      "- Contingent work pays nothing until someone starts, so a role with six agencies on it is usually worth less than a quieter role nobody has noticed. Prefer the second.",
      "- Timing beats volume. A company that just raised or just lost a leader is reachable for a few weeks. An account that has gone quiet for months needs a reason to reopen, not a check in.",
      "- The person to contact is whoever owns the hiring problem, usually the hiring manager or a talent lead, not a generic careers inbox.",
      "",
      ...(memory.length
        ? [
            "What you know about this agency and this recruiter:",
            ...memory.map((line) => `- ${line}`),
            "",
            "That context tells you what they sell, who they sell to, and how they want to be coached. It is NOT evidence. It never tells you what is true in the market today, and you may not cite it as a source or repeat it back as a finding.",
            "",
          ]
        : []),
      "Rules you do not break:",
      "1. Research before you answer. You may not state a fact about a company, person, role, funding event, or date that you did not read in a tool result. If you did not look it up, you do not know it.",
      "2. If the research comes back thin, say so and say what you could not confirm. A short honest answer beats a confident invented one.",
      "3. Never invent a company, a person, a funding round, a job posting, or a date. If a detail is not in a result, leave it out.",
      "4. Recency matters. When a tool result is labelled with a research age, treat it as of that age: say what it is dated rather than implying you just checked.",
      "5. No motivational filler and no generic advice. 'Build relationships' and 'stay top of mind' are not moves. If you cannot name a specific action, say the research does not support one yet.",
      "",
      "6. Disagree when the evidence says you should. If the user's stated plan is weaker than what the research supports, say so and say why. Agreeing with a plan you can see a problem with is the least useful thing you can do.",
      "",
      "Structure every answer with these labels, each on its own line, in this order:",
      "",
      "What changed:",
      "The grounded finding. What you actually established, with the specific company, role, amount, or person, and when it happened.",
      "",
      "Why it matters:",
      "What this means commercially FOR THIS AGENCY, given what you know about what they sell and who they sell to. Not a general observation about the market.",
      "",
      "Best next move:",
      "One action, specific enough to do today. Who to contact, on what pretext, and what to say first. One move, not a list of options.",
      "",
      "Evidence:",
      "The sources you used, one per line, each as the publication or company name and the date if you have one. If a source was recent research rather than a live look-up, say so.",
      "",
      "I'd push back:",
      "OPTIONAL, and only when you genuinely disagree with what the user is proposing or assuming. Say what you would do instead and what the research says that they may not have weighed. Omit this label entirely when you agree: a push-back on every answer is noise, and the user will stop reading it. If they push back on you a second time with a reason, take their call and say so plainly rather than repeating yourself.",
      "",
      "Write plain sentences under each label. No markdown, no bullet symbols, no headings beyond those labels. Keep the whole answer under 250 words: it is read by a recruiter between calls.",
    ].join("\n");
  }

  return [
    `You are the operations manager inside Pulse, a recruiting platform, working for ${orgName}. Today is ${today}.`,
    "",
    "You read this agency's own pipeline and tell them what moved, what stalled, and what needs them today. You have no access to the internet and you must never imply you do.",
    "",
    "Rules you do not break:",
    "1. Use the tools before answering. Every number and every name comes from a tool result, never from memory or inference.",
    "2. If a tool returns nothing, say the pipeline shows nothing rather than filling the gap.",
    "3. Only create a task when asked to, or when the user has clearly agreed to one. Never create a task speculatively.",
    "4. You cannot move candidates, send anything, or change records. When something needs doing that you cannot do, say so plainly and offer to write it as a task.",
    "",
    "How to answer:",
    "Lead with what needs them, most urgent first, and name the person and the role. Say how long something has been sitting when that is the point. Be specific about the next action.",
    "Keep it under 180 words. Plain sentences, no bullet symbols, no headings, no markdown.",
  ].join("\n");
}

function historyFor(messages: ChatRow[]): ChatMessage[] {
  return messages
    .filter((m) => m.status !== "failed" && m.body.trim().length > 0)
    .slice(-HISTORY_TURNS)
    .map((m) =>
      m.role === "user"
        ? { role: "user" as const, content: m.body }
        : { role: "assistant" as const, content: m.body },
    );
}

/**
 * Run one question to a finished answer, emitting progress as it goes.
 *
 * Throws ProviderError for anything the caller should refund and report. It
 * never returns a fabricated answer: a run that could not do its work fails.
 */
export async function runAsk({
  surface,
  question,
  history,
  orgName,
  memory = [],
  ctx,
  emit,
}: {
  surface: ChatSurface;
  question: string;
  history: ChatRow[];
  orgName: string;
  /**
   * Visible BD context, already reduced to labelled lines by memoryForPrompt.
   * Strategy and coaching only: this shapes HOW the strategist advises, never
   * what it believes to be true about the market.
   */
  memory?: string[];
  ctx: ToolContext;
  emit: (event: AskEvent) => void;
}): Promise<RunOutcome> {
  if (!hasModelKey()) {
    throw new ProviderError(
      "Pulse has no model key configured yet, so no question can be answered. Nothing was charged.",
      false,
    );
  }
  if (surface === "market" && !hasResearchKey()) {
    throw new ProviderError(
      "Pulse has no research provider configured yet, so the strategist cannot check anything. Nothing was charged.",
      false,
    );
  }

  const limits = SURFACE_LIMITS[surface];
  const tools = surface === "market" ? MARKET_TOOLS : OPS_TOOLS;
  const today = new Date().toISOString().slice(0, 10);

  const messages: ChatMessage[] = [
    // Memory sits inside the system prompt, ahead of the conversation, so
    // durable strategy outranks whatever was said three turns ago.
    { role: "system", content: systemPrompt(surface, orgName, today, memory) },
    ...historyFor(history),
    { role: "user", content: question },
  ];

  const usage: Usage = { ...EMPTY_USAGE };
  const sources: ChatSource[] = [];
  const seenSources = new Set<string>();
  const toolsUsed: string[] = [];

  emit({ type: "phase", phase: "planning" });

  let answer = "";
  let steps = 0;

  while (steps < limits.maxSteps) {
    steps += 1;

    let streamed = "";
    const turn = await streamCompletion({
      messages,
      tools,
      signal: ctx.signal,
      onDelta: (text) => {
        streamed += text;
        emit({ type: "delta", text });
      },
    });

    usage.inputTokens += turn.inputTokens;
    usage.outputTokens += turn.outputTokens;

    // No tools requested: this turn was the answer.
    if (turn.toolCalls.length === 0) {
      answer = turn.content.trim();
      break;
    }

    // The turn reached for a tool, so anything it streamed was thinking aloud
    // rather than the answer. Tell the transcript to drop it.
    if (streamed.length > 0) emit({ type: "reset" });

    messages.push({
      role: "assistant",
      content: turn.content || null,
      tool_calls: turn.toolCalls,
    });

    emit({
      type: "phase",
      phase: surface === "market" ? "searching" : "checking",
    });

    for (const call of turn.toolCalls) {
      toolsUsed.push(call.function.name);
      const outcome = await runToolSafely(surface, call, ctx);

      ctx.budget.searches -= outcome.spent.searches;
      ctx.budget.pageReads -= outcome.spent.pageReads;
      usage.searches += outcome.spent.searches;
      usage.pageReads += outcome.spent.pageReads;

      for (const step of outcome.steps) {
        emit({ type: "step", label: step.label, detail: step.detail });
      }
      for (const found of outcome.sources) {
        // Two searches routinely surface the same page. Listing it twice under
        // an answer reads as two pieces of evidence when it is one.
        const key = found.url ?? found.label;
        if (seenSources.has(key)) continue;
        seenSources.add(key);
        sources.push(found);
        emit({ type: "source", source: found });
      }

      messages.push({
        role: "tool",
        tool_call_id: call.id,
        content: outcome.result,
      });
    }

    emit({ type: "phase", phase: "writing" });
  }

  // The loop ran out of steps without the model settling on an answer. Ask once
  // more with no tools so it has to write from what it already gathered.
  if (!answer) {
    emit({ type: "phase", phase: "writing" });
    messages.push({
      role: "user",
      content:
        "Stop researching and answer now from what you already have. Say plainly what you could not confirm.",
    });
    const final = await streamCompletion({
      messages,
      signal: ctx.signal,
      onDelta: (text) => emit({ type: "delta", text }),
    });
    usage.inputTokens += final.inputTokens;
    usage.outputTokens += final.outputTokens;
    answer = final.content.trim();
  }

  // AI.md section 5: a MARKET answer built from zero sources is a failed run,
  // enforced here rather than requested in the prompt.
  if (surface === "market" && sources.length === 0) {
    throw new ProviderError(
      "The research came back empty, so there is no grounded answer to give. Nothing was charged. Try a more specific question.",
      true,
    );
  }

  if (!answer) {
    // "Try again in a moment" was wrong for the one cause this actually had.
    // A reasoning model counts its thinking inside max_completion_tokens, so
    // when the budget is too small it streams a valid, empty response and
    // retrying produces the same empty response forever. Every BD run for two
    // days failed here and the copy sent people back to try again.
    //
    // Output tokens with no text is the fingerprint: the model spent the
    // budget and emitted nothing. Say which model and which knob, because the
    // fix is configuration and nobody can guess it from "returned nothing".
    if (usage.outputTokens > 0) {
      throw new ProviderError(
        `The model "${MODEL}" used its whole output budget without writing an answer, which is what a reasoning model does when max_completion_tokens is too small for its thinking. This is a Pulse configuration problem, not something you did. Nothing was charged.`,
        false,
      );
    }
    throw new ProviderError(
      "The model returned nothing. Nothing was charged. Try again in a moment.",
      true,
    );
  }

  return {
    body: answer,
    sources,
    usage,
    credits: creditCost(usage),
    meta: {
      model: MODEL,
      steps,
      tools: toolsUsed,
      input_tokens: usage.inputTokens,
      output_tokens: usage.outputTokens,
      searches: usage.searches,
      page_reads: usage.pageReads,
    },
  };
}

// A tool that throws must not kill the run. The model is told what went wrong
// and can adjust, which is usually better than failing the whole question.
// A provider-level failure is the exception: that one is fatal and refunded.
async function runToolSafely(
  surface: ChatSurface,
  call: ToolCall,
  ctx: ToolContext,
) {
  try {
    return await runTool(surface, call.function.name, call.function.arguments, ctx);
  } catch (error) {
    if (error instanceof ProviderError && !error.retryable) throw error;
    return {
      result: JSON.stringify({
        error: error instanceof Error ? error.message : "The tool failed.",
      }),
      steps: [
        {
          label: "Failed",
          detail: `${call.function.name} did not return`,
        },
      ],
      sources: [],
      spent: { searches: 0, pageReads: 0 },
    };
  }
}
