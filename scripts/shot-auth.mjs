// Screenshot signed-in routes for the design-review skill.
//
//   node scripts/shot-auth.mjs <baseUrl> <route> <out.png> [width] [height]
//
// shot.mjs cannot photograph anything inside the product: every app route is
// behind the session middleware, so it lands on /signin and the review ends up
// judging the wrong screen. This signs in with the demo login first.
//
// Credentials come from PULSE_DEMO_EMAIL and PULSE_DEMO_PASSWORD, falling back
// to the seeded demo account recorded in supabase/README.md.

import { chromium } from "@playwright/test";

const [base, route, out, width = "1440", height = "1000"] = process.argv.slice(2);

if (!base || !route || !out) {
  console.error(
    "usage: node scripts/shot-auth.mjs <baseUrl> <route> <out.png> [width] [height]",
  );
  process.exit(1);
}

const email = process.env.PULSE_DEMO_EMAIL ?? "daniyal@nortech.io";
const password = process.env.PULSE_DEMO_PASSWORD ?? "pulse-demo-2026";

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: Number(width), height: Number(height) },
  deviceScaleFactor: 2,
});

await page.goto(`${base}/signin`, { waitUntil: "load" });
await page.getByLabel("Email").fill(email);
await page.getByLabel("Password").fill(password);
await page.getByRole("button", { name: /sign in/i }).click();
await page.waitForURL(/\/(pipeline|candidates)/, { timeout: 20_000 });

const startedAt = Date.now();
await page.goto(`${base}${route}`, { waitUntil: "load" });
const loadMs = Date.now() - startedAt;

// Fonts settle after load. A shot taken mid-swap judges the wrong type.
await page.evaluate(() => document.fonts.ready);

await page.screenshot({ path: out, fullPage: true });
await browser.close();

console.log(`loaded ${route} in ${loadMs}ms`);
console.log(`wrote ${out}`);
