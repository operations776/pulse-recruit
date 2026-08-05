import "server-only";

// The model transport. One central RecruiterGTM key, read only here and in
// exa.ts (AI.md section 1). No SDK: the streaming chat API is a POST and a
// line reader, and a pinned dependency we would have to track is not worth it.

const ENDPOINT = "https://api.openai.com/v1/chat/completions";

// Changing model is changing this env var, and the token rates in pricing.ts in
// the same commit. Both moved together in PLS-94.
//
// gpt-5, because the BD Strategist has to reason across live research results
// rather than retrieve a fact: it weighs several sources, decides which
// opportunity is worth a recruiter's next hour, and defends the choice. That
// is the work a frontier model earns its price on. It keeps the same Chat
// Completions, streaming and tool-calling surface this file already speaks, so
// nothing below changed.
//
// Still an env var, deliberately. A later model may be a better cost-quality
// trade, and this should be one variable and two rates, not a code change.
export const MODEL = process.env.OPENAI_MODEL ?? "gpt-5";

export type ToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};

export type ChatMessage =
  | { role: "system"; content: string }
  | { role: "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: ToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };

export type ToolSchema = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

export type CompletionResult = {
  content: string;
  toolCalls: ToolCall[];
  inputTokens: number;
  outputTokens: number;
  // The model stopped because it hit a limit rather than because it finished.
  truncated: boolean;
};

export class ProviderError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}

export function hasModelKey(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

function requireKey(): string {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    throw new ProviderError(
      "No model key is configured, so nothing was asked and nothing was charged.",
      false,
    );
  }
  return key;
}

// Provider failures are translated once, here, into something a recruiter can
// act on. AI.md section 4: never a raw status code in the transcript.
function readableFailure(status: number, body: string): ProviderError {
  if (status === 401 || status === 403) {
    return new ProviderError(
      "The model key was rejected. This is a Pulse configuration problem, not something you did.",
      false,
    );
  }
  if (status === 429) {
    return new ProviderError(
      "The model is rate limited right now. Try again in a moment.",
      true,
    );
  }
  if (status >= 500) {
    return new ProviderError(
      "The model provider is having trouble. Try again in a moment.",
      true,
    );
  }
  const detail = body.slice(0, 200).trim();
  return new ProviderError(
    detail ? `The model refused the request: ${detail}` : "The model refused the request.",
    false,
  );
}

type StreamChoiceDelta = {
  content?: string | null;
  tool_calls?: {
    index: number;
    id?: string;
    function?: { name?: string; arguments?: string };
  }[];
};

/**
 * One turn of the conversation, streamed.
 *
 * Text arrives through onDelta as it is produced. Tool calls do not: they are
 * accumulated across chunks and returned whole, because a half-parsed argument
 * object is not something a caller can act on.
 */
export async function streamCompletion({
  messages,
  tools,
  signal,
  onDelta,
  maxOutputTokens = 1200,
}: {
  messages: ChatMessage[];
  tools?: ToolSchema[];
  signal?: AbortSignal;
  onDelta?: (text: string) => void;
  maxOutputTokens?: number;
}): Promise<CompletionResult> {
  const payload = (withTemperature: boolean) => ({
    model: MODEL,
    messages,
    ...(tools?.length ? { tools, tool_choice: "auto" } : {}),
    stream: true,
    // Without this the final chunk carries no usage block and the meter has
    // nothing real to bill from.
    stream_options: { include_usage: true },
    max_completion_tokens: maxOutputTokens,
    // Low temperature is right for research: we want the same evidence to
    // produce the same reading twice. But OpenAI documents that parameter
    // support differs on reasoning models, and some accept only the default,
    // so this is sent as a preference rather than a requirement. See the
    // retry below.
    ...(withTemperature ? { temperature: 0.2 } : {}),
  });

  const send = (withTemperature: boolean) =>
    fetch(ENDPOINT, {
      method: "POST",
      signal,
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${requireKey()}`,
      },
      body: JSON.stringify(payload(withTemperature)),
    });

  let response = await send(true);

  // A model that refuses `temperature` must not take the whole surface down
  // with it. This is the one documented way an otherwise valid request can
  // fail purely on a parameter we do not need, so it costs one retry rather
  // than an outage. Nothing has streamed yet and no credits have been spent
  // beyond the reservation, so retrying here is free and invisible.
  if (response.status === 400) {
    const body = await response.text().catch(() => "");
    if (/temperature/i.test(body)) {
      response = await send(false);
    } else {
      throw readableFailure(400, body);
    }
  }

  if (!response.ok || !response.body) {
    const body = await response.text().catch(() => "");
    throw readableFailure(response.status, body);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  let buffer = "";
  let content = "";
  let inputTokens = 0;
  let outputTokens = 0;
  let finishReason = "";
  const partials = new Map<number, ToolCall>();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    // The last line may be half a frame. Keep it for the next chunk.
    buffer = lines.pop() ?? "";

    for (const raw of lines) {
      const line = raw.trim();
      if (!line.startsWith("data:")) continue;

      const payload = line.slice(5).trim();
      if (payload === "[DONE]") continue;

      let chunk: {
        choices?: { delta?: StreamChoiceDelta; finish_reason?: string | null }[];
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };
      try {
        chunk = JSON.parse(payload);
      } catch {
        continue;
      }

      // Usage arrives on its own final chunk, after the choices are done.
      if (chunk.usage) {
        inputTokens = chunk.usage.prompt_tokens ?? inputTokens;
        outputTokens = chunk.usage.completion_tokens ?? outputTokens;
      }

      const choice = chunk.choices?.[0];
      if (!choice) continue;
      if (choice.finish_reason) finishReason = choice.finish_reason;

      const text = choice.delta?.content;
      if (text) {
        content += text;
        onDelta?.(text);
      }

      for (const part of choice.delta?.tool_calls ?? []) {
        const existing = partials.get(part.index) ?? {
          id: "",
          type: "function" as const,
          function: { name: "", arguments: "" },
        };
        if (part.id) existing.id = part.id;
        if (part.function?.name) existing.function.name += part.function.name;
        if (part.function?.arguments) {
          existing.function.arguments += part.function.arguments;
        }
        partials.set(part.index, existing);
      }
    }
  }

  return {
    content,
    toolCalls: [...partials.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([, call]) => call)
      .filter((call) => call.id && call.function.name),
    inputTokens,
    outputTokens,
    truncated: finishReason === "length",
  };
}
