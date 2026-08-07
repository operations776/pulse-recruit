// End-to-end check of the two writes Mara's screen makes.
//
// Both go through server actions behind RLS, so the only honest way to know
// they work is to drive the browser as a signed-in recruiter and then look at
// the rows. Typecheck cannot see a policy that refuses a write, and a toast
// saying "Mara has it" is what the client shows whether or not the row landed.
//
// Usage: node scripts/verify-mara.mjs <baseUrl>
import { chromium } from "@playwright/test";

const baseUrl = process.argv[2] ?? "http://localhost:3000";
const email = process.env.PULSE_DEMO_EMAIL ?? "daniyal@nortech.io";
const password = process.env.PULSE_DEMO_PASSWORD ?? "pulse-demo-2026";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });

await page.goto(`${baseUrl}/signin`, { waitUntil: "load" });
await page.fill('input[type="email"]', email);
await page.fill('input[type="password"]', password);
await page.click('button[type="submit"]');
await page.waitForURL((url) => !url.pathname.startsWith("/signin"), {
  timeout: 30_000,
});

await page.goto(`${baseUrl}/market`, { waitUntil: "load" });

// 1. Today's play logs a commitment.
const play = page.getByRole("button", { name: "I'll do this" }).first();
if ((await play.count()) === 0) {
  console.log("PLAY: no play card on screen, nothing to commit");
} else {
  await play.click();
  await page.getByText("On your list").first().waitFor({ timeout: 15_000 });
  console.log("PLAY: committed");
}

// 2. The ledger shows it, and Done settles it.
await page.reload({ waitUntil: "load" });
const done = page.getByRole("button", { name: "Done" }).first();
if ((await done.count()) === 0) {
  console.log("LEDGER: FAIL, the commitment did not come back after reload");
} else {
  console.log("LEDGER: commitment persisted");
  await done.click();
  // Settling removes the row, so the ledger empties back to its honest line.
  await page
    .getByText("Nothing outstanding", { exact: false })
    .first()
    .waitFor({ timeout: 15_000 });
  console.log("LEDGER: settled and cleared");
}

// 3. Tell Mara something writes a memory.
await page.getByRole("button", { name: "Tell Mara something" }).first().click();

await page.waitForSelector('[role="dialog"]');
// Scoped to the dialog: the same label exists behind the scrim in the persona
// panel, and an unscoped match picks the covered one.
await page
  .locator('[role="dialog"]')
  .getByRole("button", { name: "Your fee model" })
  .click();
await page.locator('[role="dialog"] textarea').fill("25 percent of first year base, invoiced on start date.");
await page
  .locator('[role="dialog"]')
  .getByRole("button", { name: "Save", exact: true })
  .click();
await page.waitForSelector('[role="dialog"]', { state: "detached", timeout: 15_000 });
await page.reload({ waitUntil: "load" });

// The amber "Add your fee model" chip is the gap. Once the memory exists it
// must be gone, which is the only proof the row was really written.
const stillMissing = await page
  .getByRole("button", { name: "Add your fee model" })
  .count();
console.log(
  stillMissing === 0
    ? "MEMORY: written, the fee-model gap closed"
    : "MEMORY: FAIL, the gap chip is still showing after a reload",
);

await browser.close();
