import "server-only";
import { ProviderError } from "@/lib/server/ai/openai";

// The research transport. AI.md section 8 fixes this shape so a second provider
// (Perplexity is next) is a sibling file implementing the same two functions,
// and nothing above this layer changes.

const SEARCH_ENDPOINT = "https://api.exa.ai/search";
const CONTENTS_ENDPOINT = "https://api.exa.ai/contents";

// Enough of a page for the model to quote accurately, not so much that a single
// read swamps the context and pushes the token bill up for no added truth.
const MAX_CHARS_PER_RESULT = 2400;

export type ResearchHit = {
  title: string;
  url: string;
  publishedDate: string | null;
  author: string | null;
  text: string;
};

export function hasResearchKey(): boolean {
  return Boolean(process.env.EXA_API_KEY);
}

function requireKey(): string {
  const key = process.env.EXA_API_KEY;
  if (!key) {
    throw new ProviderError(
      "No research provider is configured, so nothing was searched and nothing was charged.",
      false,
    );
  }
  return key;
}

async function post<T>(url: string, body: unknown, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    signal,
    headers: {
      "content-type": "application/json",
      "x-api-key": requireKey(),
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    if (response.status === 401 || response.status === 403) {
      throw new ProviderError(
        "The research key was rejected. This is a Pulse configuration problem, not something you did.",
        false,
      );
    }
    if (response.status === 429) {
      throw new ProviderError(
        "Research is rate limited right now. Try again in a moment.",
        true,
      );
    }
    if (response.status >= 500) {
      throw new ProviderError(
        "The research provider is having trouble. Try again in a moment.",
        true,
      );
    }
    throw new ProviderError(
      `The research provider refused the request: ${detail.slice(0, 200).trim()}`,
      false,
    );
  }

  return (await response.json()) as T;
}

type RawResult = {
  title?: string | null;
  url?: string;
  publishedDate?: string | null;
  author?: string | null;
  text?: string | null;
};

function normalize(results: RawResult[] | undefined): ResearchHit[] {
  return (results ?? [])
    .filter((r): r is RawResult & { url: string } => Boolean(r.url))
    .map((r) => ({
      title: r.title?.trim() || r.url,
      url: r.url,
      publishedDate: r.publishedDate ?? null,
      author: r.author?.trim() || null,
      text: (r.text ?? "").slice(0, MAX_CHARS_PER_RESULT).trim(),
    }));
}

/**
 * Search the live web and return page text in the same call.
 *
 * One call rather than search-then-fetch because the model cannot judge which
 * result is worth reading from a title alone, and a second round trip per
 * result is the slowest thing a research run can do.
 */
export async function search({
  query,
  numResults = 6,
  category,
  publishedAfter,
  signal,
}: {
  query: string;
  numResults?: number;
  category?: string;
  publishedAfter?: string;
  signal?: AbortSignal;
}): Promise<ResearchHit[]> {
  const data = await post<{ results?: RawResult[] }>(
    SEARCH_ENDPOINT,
    {
      query,
      numResults: Math.min(Math.max(numResults, 1), 10),
      type: "auto",
      ...(category ? { category } : {}),
      ...(publishedAfter ? { startPublishedDate: publishedAfter } : {}),
      contents: {
        text: { maxCharacters: MAX_CHARS_PER_RESULT },
        livecrawl: "fallback",
      },
    },
    signal,
  );

  return normalize(data.results);
}

/** Read specific pages the model has already decided are worth reading. */
export async function readPages({
  urls,
  signal,
}: {
  urls: string[];
  signal?: AbortSignal;
}): Promise<ResearchHit[]> {
  if (urls.length === 0) return [];

  const data = await post<{ results?: RawResult[] }>(
    CONTENTS_ENDPOINT,
    {
      urls: urls.slice(0, 5),
      text: { maxCharacters: MAX_CHARS_PER_RESULT },
      livecrawl: "fallback",
    },
    signal,
  );

  return normalize(data.results);
}
