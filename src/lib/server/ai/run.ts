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

function systemPrompt(surface: ChatSurface, orgName: string, today: string): string {
  if (surface === "market") {
    return [
      `You are the BD engine inside Pulse, a recruiting platform. You work for ${orgName}, a recruitment agency. Today is ${today}.`,
      "",
      "Your job is to find business development opportunities: companies hiring, companies that raised money, leadership moves that open a gap, and teams with no in-house talent lead.",
      "",
      "Rules you do not break:",
      "1. Search before you answer. You may not state a fact you did not read in a tool result. If you did not search, you do not know.",
      "2. If the searches come back thin, say so and say what you could not confirm. A short honest answer beats a confident invented one.",
      "3. Never invent a company, a person, a funding round, a job posting, or a date. If a detail is not in a result, leave it out.",
      "4. Recency matters. When the question is about what is happening now, restrict the search by date and say how fresh the evidence is.",
      "",
      "How to answer:",
      "Lead with the answer, not with what you did. Name the specific companies and why each one is worth a call, in the order you would call them. Be concrete: a role posted, an amount raised, a person who moved. Then say what the strongest first move is.",
      "Keep it under 200 words unless the question genuinely needs more. Plain sentences, no bullet symbols, no headings, no markdown. This is read by a recruiter between calls.",
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
  ctx,
  emit,
}: {
  surface: ChatSurface;
  question: string;
  history: ChatRow[];
  orgName: string;
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
      "Pulse has no research provider configured yet, so the BD engine cannot check anything. Nothing was charged.",
      false,
    );
  }

  const limits = SURFACE_LIMITS[surface];
  const tools = surface === "market" ? MARKET_TOOLS : OPS_TOOLS;
  const today = new Date().toISOString().slice(0, 10);

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt(surface, orgName, today) },
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
