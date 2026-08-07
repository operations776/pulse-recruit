import "server-only";

// AI.md section 2. One credit is one US cent of provider spend, and every rate
// in the product lives in this file.
//
// IMPORTANT: these are configured defaults, not quoted prices. Confirm each one
// against the provider's current pricing page before the pilot takes real
// money, and change it here. Nothing else reads a rate.

export const CREDITS_PER_USD = 100;

// USD per 1,000,000 tokens. Override the model with OPENAI_MODEL and update
// these two numbers in the same change, or the meter silently lies.
//
// gpt-4.1: $2.00 in, $8.00 out.
//
// PLS-134 moved off gpt-5 because it did not work. gpt-5 is a reasoning model
// and its reasoning tokens are billed and counted inside
// max_completion_tokens, so on this surface's budget it spent the whole
// allowance thinking and streamed no text at all. Every BD run since the
// default changed failed with "the model returned nothing", HTTP 200, zero
// charged. A model that cannot answer is not worth a better reasoning score.
//
// Input is dearer than gpt-5 ($1.25) and output is cheaper ($10.00). Output
// dominates a briefing, so a typical run lands slightly cheaper, and the
// direction that matters is that it lands at all.
//
// Cached input is billed at a discount. We do not model it: it would make the
// meter optimistic, and under-charging our own ledger is the safer direction
// to be wrong in.
export const MODEL_RATES = {
  inputPerMillionUsd: 2,
  outputPerMillionUsd: 8,
} as const;

// USD per unit of research.
export const RESEARCH_RATES = {
  searchUsd: 0.005,
  pageReadUsd: 0.001,
} as const;

// What a surface may reserve before it runs, and the work ceiling that keeps a
// run inside it. A run that hits a ceiling answers with what it has rather than
// billing past the reservation (AI.md section 3).
export const SURFACE_LIMITS = {
  market: {
    reserveCredits: 25,
    maxSearches: 6,
    maxPageReads: 8,
    maxSteps: 8,
  },
  ops: {
    // OPS touches no paid research API, so its only cost is tokens over the
    // org's own rows. It is cheap on purpose. PLS-133 removed its screen, so
    // the only caller left is the MCP server: this rate now prices Claude
    // working the pipeline from outside the product rather than a chat inside it.
    reserveCredits: 6,
    maxSearches: 0,
    maxPageReads: 0,
    maxSteps: 10,
  },
  content: {
    // Writing a post is one long completion from a persona and a shape, with
    // no tools at all: no web, no pipeline reads, nothing to wander into. The
    // reservation covers a generous draft plus the persona in context, and
    // maxSteps is 1 because there is nothing for a second step to do.
    //
    // Deliberately larger than OPS. A post is hundreds of output tokens and
    // output is priced at four times input, so a six credit ceiling would cut
    // drafts off mid sentence.
    reserveCredits: 10,
    maxSearches: 0,
    maxPageReads: 0,
    maxSteps: 1,
  },
} as const;

export type Usage = {
  inputTokens: number;
  outputTokens: number;
  searches: number;
  pageReads: number;
};

export const EMPTY_USAGE: Usage = {
  inputTokens: 0,
  outputTokens: 0,
  searches: 0,
  pageReads: 0,
};

export function usdCost(usage: Usage): number {
  return (
    (usage.inputTokens / 1_000_000) * MODEL_RATES.inputPerMillionUsd +
    (usage.outputTokens / 1_000_000) * MODEL_RATES.outputPerMillionUsd +
    usage.searches * RESEARCH_RATES.searchUsd +
    usage.pageReads * RESEARCH_RATES.pageReadUsd
  );
}

// Round up, always. Rounding down at scale means we pay the remainder.
export function creditCost(usage: Usage): number {
  const raw = usdCost(usage) * CREDITS_PER_USD;
  if (raw <= 0) return 0;
  return Math.max(1, Math.ceil(raw));
}
