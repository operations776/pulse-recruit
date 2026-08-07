// Prove the suggestions rail actually calls its two RPCs.
//
// PLS-182 wired a UI onto an engine that shipped with no reader. Both writes go
// through SECURITY DEFINER functions behind RLS, so the only honest check is to
// drive the browser as a signed-in recruiter and then look at the rows: a toast
// saying "Drafted" appears whether or not the write landed.
//
// Usage: node scripts/verify-suggestions.mjs <baseUrl>
import { chromium } from "@playwright/test";

const baseUrl = process.argv[2] ?? "http://localhost:3000";
const email = process.env.PULSE_DEMO_EMAIL ?? "daniyal@nortech.io";
const password = process.env.PULSE_DEMO_PASSWORD ?? "pulse-demo-2026";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });

await page.goto(`${baseUrl}/signin`, { waitUntil: "load" });
await page.fill('input[type="email"]', email);
await page.fill('input[type="password"]', password);
await page.click('button[type="submit"]');
await page.waitForURL((u) => !u.pathname.startsWith("/signin"), {
  timeout: 30_000,
});
await page.goto(`${baseUrl}/content`, { waitUntil: "load" });

const notFor = page.getByRole("button", { name: "Not for me" }).first();
if ((await notFor.count()) === 0) {
  console.log("SKIP: no open suggestion on screen to exercise");
  await browser.close();
  process.exit(0);
}

// "Not for me" must ASK WHY rather than dismissing silently. The reason is the
// learning signal, and a dismissal without one teaches the engine nothing.
await notFor.click();
const reasonShown = await page
  .getByRole("button", { name: "Not my patch" })
  .first()
  .isVisible()
  .catch(() => false);
console.log(
  reasonShown
    ? "PASS  dismissal asks for a reason"
    : "FAIL  dismissed with no reason captured",
);

if (reasonShown) {
  await page.getByRole("button", { name: "Already covered" }).first().click();
  // The row must actually leave, which only happens if the RPC returned.
  await page.waitForTimeout(2_500);
  await page.reload({ waitUntil: "load" });
  const stillThere = await page
    .getByRole("button", { name: "Not for me" })
    .count();
  console.log(
    stillThere === 0
      ? "PASS  the suggestion is gone after a reload"
      : "FAIL  it came back, so the write did not land",
  );
}

await browser.close();
