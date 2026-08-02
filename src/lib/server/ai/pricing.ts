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
export const MODEL_RATES = {
  inputPerMillionUsd: 2.5,
  outputPerMillionUsd: 10,
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
    // org's own rows. It is cheap on purpose: the morning brief should never
    // feel like something you ration.
    reserveCredits: 6,
    maxSearches: 0,
    maxPageReads: 0,
    maxSteps: 10,
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
