// Photograph the conversation view, which no shot of /market can reach.
//
// /market now lands on the stage, so an open thread is only visible via ?c=,
// and that view uses the OTHER branch of every layout switch the chromeless
// work touched. A screenshot of the landing state proves nothing about it.
//
// Usage: node scripts/shot-mara-thread.mjs <outDir> <baseUrl> <light|dark>
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const [outDir, baseUrl, theme = "light"] = process.argv.slice(2);

if (!outDir || !baseUrl) {
  console.error("usage: node scripts/shot-mara-thread.mjs <outDir> <baseUrl> <theme>");
  process.exit(1);
}

const width = Number(process.env.PULSE_SHOT_WIDTH ?? 1440);
const height = Number(process.env.PULSE_SHOT_HEIGHT ?? 820);
const email = process.env.PULSE_DEMO_EMAIL ?? "daniyal@nortech.io";
const password = process.env.PULSE_DEMO_PASSWORD ?? "pulse-demo-2026";

mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width, height } });
await context.addInitScript((v) => {
  window.localStorage.setItem("pulse.theme", v);
}, theme);

const page = await context.newPage();
await page.goto(`${baseUrl}/signin`, { waitUntil: "load" });
await page.fill('input[type="email"]', email);
await page.fill('input[type="password"]', password);
await page.click('button[type="submit"]');
await page.waitForURL((u) => !u.pathname.startsWith("/signin"), { timeout: 30_000 });

await page.goto(`${baseUrl}/market`, { waitUntil: "load" });

// Straight to the thread by id. Clicking through the drawer picked whichever
// button happened to be second in the DOM, which was not a conversation row,
// and the shot silently came back as the landing state.
const threadId = process.env.PULSE_THREAD_ID;
if (!threadId) {
  console.error("set PULSE_THREAD_ID to a market conversation id");
  await browser.close();
  process.exit(1);
}
await page.goto(`${baseUrl}/market?c=${threadId}`, { waitUntil: "load" });

// Prove a transcript actually rendered rather than trusting the URL: the
// landing state has no assistant turn on it at all.
await page.waitForSelector("text=BUILT FROM, text=Evidence, .whitespace-pre-line", {
  timeout: 15_000,
}).catch(() => {});

const out = `${outDir}/thread-${theme}.png`;
await page.screenshot({ path: out });
console.log(`thread -> ${out}`);

await browser.close();
