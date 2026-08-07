// Ask a real question and report what actually came back.
//
// PLS-134 changed the model because every run was returning empty. A config
// change cannot prove itself: the only evidence that the chat works is a run
// that produces an answer with sources and a settled credit cost. This drives
// the deployed app as a signed-in recruiter and says which of those happened.
//
// Costs real credits, deliberately. A dry run proves nothing.
//
// Usage: node scripts/verify-ask.mjs <baseUrl> ["question"]
import { chromium } from "@playwright/test";

const baseUrl = process.argv[2] ?? "http://localhost:3000";
const question =
  process.argv[3] ?? "Which of my Dream 100 are hiring right now?";
const email = process.env.PULSE_DEMO_EMAIL ?? "daniyal@nortech.io";
const password = process.env.PULSE_DEMO_PASSWORD ?? "pulse-demo-2026";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });

await page.goto(`${baseUrl}/signin`, { waitUntil: "load" });
await page.fill('input[type="email"]', email);
await page.fill('input[type="password"]', password);
await page.click('button[type="submit"]');
await page.waitForURL((u) => !u.pathname.startsWith("/signin"), {
  timeout: 30_000,
});

await page.goto(`${baseUrl}/market?c=new`, { waitUntil: "load" });

const composer = page.locator("textarea").last();
if (await composer.isDisabled()) {
  console.log("COMPOSER DISABLED: no model or research key on this deployment");
  await browser.close();
  process.exit(1);
}

await composer.fill(question);
await page.getByRole("button", { name: "Ask", exact: true }).click();

// A research run takes a while. Wait for it to settle either way rather than
// for a fixed time: an answer, or a failure notice naming the reason.
const answered = page.locator("text=What changed").first();
const failed = page.locator("text=NOT ANSWERED").first();

const outcome = await Promise.race([
  answered.waitFor({ timeout: 180_000 }).then(() => "answered"),
  failed.waitFor({ timeout: 180_000 }).then(() => "failed"),
]).catch(() => "timeout");

if (outcome === "answered") {
  const sources = await page.locator("text=Evidence").count();
  console.log(`ANSWERED. Evidence section present: ${sources > 0}`);
} else if (outcome === "failed") {
  const reason = await page
    .locator("text=NOT ANSWERED")
    .locator("xpath=..")
    .innerText()
    .catch(() => "(could not read the reason)");
  console.log(`FAILED: ${reason.replace(/\s+/g, " ").trim()}`);
} else {
  console.log("TIMEOUT: the run neither answered nor failed in three minutes.");
}

await browser.close();
process.exit(outcome === "answered" ? 0 : 1);
