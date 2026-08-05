// Prove the platform keys work, before a customer finds out they do not.
//
//   node scripts/verify-ai.mjs
//
// Reads OPENAI_API_KEY and EXA_API_KEY from the environment, falling back to
// .env.local. Makes one small real call to each provider, prices it with the
// same rates the product bills with, and reports what a question would cost.
//
// This is the check to run after adding the keys in Vercel, and again after
// changing OPENAI_MODEL or any rate in src/lib/server/ai/pricing.ts.

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// Same numbers as pricing.ts. Kept in step by hand deliberately: this script
// must be runnable without building the app.
const CREDITS_PER_USD = 100;
const RATES = {
  // gpt-5, matching MODEL_RATES in pricing.ts. Both move together or this
  // script reports a cost the product does not charge.
  inputPerMillionUsd: 1.25,
  outputPerMillionUsd: 10,
  searchUsd: 0.005,
  pageReadUsd: 0.001,
};

function loadEnvLocal() {
  try {
    const text = readFileSync(resolve(root, ".env.local"), "utf8");
    for (const line of text.split("\n")) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!match) continue;
      const [, key, rawValue] = match;
      if (process.env[key]) continue;
      process.env[key] = rawValue.replace(/^["']|["']$/g, "");
    }
  } catch {
    // No .env.local is fine when the variables are already exported.
  }
}

const pass = (msg) => console.log(`  PASS  ${msg}`);
const fail = (msg) => console.log(`  FAIL  ${msg}`);
const note = (msg) => console.log(`        ${msg}`);

async function checkModel() {
  const key = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL ?? "gpt-5";

  if (!key) {
    fail("OPENAI_API_KEY is not set. The BD engine and the ops manager cannot answer.");
    return { ok: false, usd: 0 };
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      messages: [
        { role: "user", content: "Reply with the single word: ready" },
      ],
      max_completion_tokens: 8,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    fail(`Model call failed with ${response.status}. ${body.slice(0, 180)}`);
    if (response.status === 404) {
      note(`The model "${model}" was not found. Set OPENAI_MODEL to one your account can use.`);
    }
    return { ok: false, usd: 0 };
  }

  const data = await response.json();
  const input = data.usage?.prompt_tokens ?? 0;
  const output = data.usage?.completion_tokens ?? 0;
  const usd =
    (input / 1_000_000) * RATES.inputPerMillionUsd +
    (output / 1_000_000) * RATES.outputPerMillionUsd;

  pass(`Model "${model}" answered. ${input} in, ${output} out.`);
  return { ok: true, usd };
}

async function checkResearch() {
  const key = process.env.EXA_API_KEY;

  if (!key) {
    fail("EXA_API_KEY is not set. The BD engine cannot check anything.");
    return { ok: false, usd: 0 };
  }

  const response = await fetch("https://api.exa.ai/search", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": key },
    body: JSON.stringify({
      query: "recruitment agency hiring software engineers London",
      numResults: 3,
      type: "auto",
      contents: { text: { maxCharacters: 400 } },
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    fail(`Research call failed with ${response.status}. ${body.slice(0, 180)}`);
    return { ok: false, usd: 0 };
  }

  const data = await response.json();
  const results = data.results ?? [];

  if (results.length === 0) {
    fail("Research returned no results. The key works but the response was empty.");
    return { ok: false, usd: RATES.searchUsd };
  }

  pass(`Research answered with ${results.length} results.`);
  note(`First result: ${results[0].title ?? results[0].url}`);
  return { ok: true, usd: RATES.searchUsd };
}

loadEnvLocal();

console.log("\nPulse AI engine, live key check\n");

const model = await checkModel();
const researchResult = await checkResearch();

console.log("\nWhat a real question would cost\n");

// A typical market run: 6 searches, 4 page reads, and the tokens those results
// push through the model. The token figures are a working estimate for sizing
// the reservation, not a measurement.
const typicalUsd =
  6 * RATES.searchUsd +
  4 * RATES.pageReadUsd +
  (28_000 / 1_000_000) * RATES.inputPerMillionUsd +
  (900 / 1_000_000) * RATES.outputPerMillionUsd;
const typicalCredits = Math.max(1, Math.ceil(typicalUsd * CREDITS_PER_USD));

note(`This check spent about ${((model.usd + researchResult.usd) * 100).toFixed(2)} credits.`);
note(`A busy BD question costs roughly ${typicalCredits} credits against a 25 credit reservation.`);
note("A 250 credit weekly allowance is about 2.50 USD of provider spend.");

if (!model.ok || !researchResult.ok) {
  console.log("\nThe engine is NOT ready. Fix the failures above, then run this again.\n");
  process.exit(1);
}

console.log("\nBoth providers answered. The engine is ready.\n");
