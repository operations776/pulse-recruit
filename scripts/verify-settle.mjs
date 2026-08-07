// Prove the settle animation runs, and prove the row really leaves.
//
// PLS-139 made crossing a promise off animate optimistically: the row strikes
// through and collapses on the click, before the server answers. Two things
// can go wrong that a screenshot never catches. The animation might not fire
// at all, and the optimistic removal might be a lie if the write then fails.
//
// This drives a real click and checks: the class lands, the row collapses,
// and after a reload the commitment is genuinely gone.
//
// Usage: node scripts/verify-settle.mjs <baseUrl>
import { chromium } from "@playwright/test";

const baseUrl = process.argv[2] ?? "http://localhost:3000";
const email = process.env.PULSE_DEMO_EMAIL ?? "daniyal@nortech.io";
const password = process.env.PULSE_DEMO_PASSWORD ?? "pulse-demo-2026";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

await page.goto(`${baseUrl}/signin`, { waitUntil: "load" });
await page.fill('input[type="email"]', email);
await page.fill('input[type="password"]', password);
await page.click('button[type="submit"]');
await page.waitForURL((u) => !u.pathname.startsWith("/signin"), {
  timeout: 30_000,
});
await page.goto(`${baseUrl}/market`, { waitUntil: "load" });

// Need a commitment to settle. "I'll do this" creates one from the top signal.
const play = page.getByRole("button", { name: "I'll do this" });
if ((await play.count()) === 0) {
  console.log("SKIP: no play card, so nothing to commit and nothing to settle");
  await browser.close();
  process.exit(0);
}
await play.first().click();
await page.getByText("On your list").first().waitFor({ timeout: 15_000 });
await page.reload({ waitUntil: "load" });

const done = page.getByRole("button", { name: "Done" }).first();
if ((await done.count()) === 0) {
  console.log("FAIL: the commitment did not persist, nothing to settle");
  await browser.close();
  process.exit(1);
}

// The row that owns this button, so we can watch it rather than the list.
const row = page.locator("div.commitment-settled, div").filter({ has: done }).last();
const before = await row.boundingBox();

await done.click();

// 1. The animation class lands. Checked immediately, because the whole point
//    is that it happens on the click rather than on the server's answer.
const animating = await page
  .locator(".commitment-settled")
  .first()
  .waitFor({ timeout: 2_000 })
  .then(() => true)
  .catch(() => false);
console.log(`ANIMATION CLASS: ${animating ? "applied on click" : "NEVER APPLIED"}`);

// 2. It actually collapses. A class that animates nothing is the failure mode
//    a class-name assertion alone would miss.
await page.waitForTimeout(400);
const after = await page.locator(".commitment-settled").first().boundingBox().catch(() => null);
const collapsed = !after || (before && after.height < before.height / 2);
console.log(
  `COLLAPSE: ${collapsed ? "row collapsed" : `still ${after?.height}px (was ${before?.height}px)`}`,
);

// 3. The optimism was honest. If the write failed, the row comes back.
await page.waitForTimeout(1_500);
await page.reload({ waitUntil: "load" });
const stillThere = await page.getByRole("button", { name: "Done" }).count();
console.log(
  stillThere === 0
    ? "PERSISTED: the promise is genuinely settled"
    : "FAIL: the row animated away but is still open after a reload",
);

await browser.close();
process.exit(animating && collapsed && stillThere === 0 ? 0 : 1);
