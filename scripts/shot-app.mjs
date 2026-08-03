// Screenshot routes that need a session, for the design-review skill.
//
// scripts/shot.mjs cannot reach anything inside (app): every product route
// redirects an anonymous request to /signin, so it was silently reviewing the
// sign-in page. This signs in once with the seeded demo account and reuses the
// context for every route.
//
// Usage: node scripts/shot-app.mjs <outDir> <baseUrl> <path> [path...]
//        PULSE_SHOT_WIDTH=900 node scripts/shot-app.mjs ... for the narrow pass
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const [outDir, baseUrl, ...paths] = process.argv.slice(2);

if (!outDir || !baseUrl || paths.length === 0) {
  console.error(
    "usage: node scripts/shot-app.mjs <outDir> <baseUrl> <path> [path...]",
  );
  process.exit(1);
}

const width = Number(process.env.PULSE_SHOT_WIDTH ?? 1440);
const height = Number(process.env.PULSE_SHOT_HEIGHT ?? 1000);
const email = process.env.PULSE_DEMO_EMAIL ?? "daniyal@nortech.io";
const password = process.env.PULSE_DEMO_PASSWORD ?? "pulse-demo-2026";

mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width, height },
  deviceScaleFactor: 2,
});

const signIn = await context.newPage();
await signIn.goto(`${baseUrl}/signin`, { waitUntil: "load" });
await signIn.getByLabel("Email").fill(email);
await signIn.getByLabel("Password").fill(password);
await signIn.getByRole("button", { name: /sign in/i }).click();
await signIn.waitForURL(/\/(pipeline|candidates)/, { timeout: 30_000 });
await signIn.close();

let failed = 0;

for (const path of paths) {
  const name =
    path.replace(/^\/|\/$/g, "").replace(/[/?=&]/g, "_") || "home";
  const page = await context.newPage();
  try {
    const startedAt = Date.now();
    await page.goto(`${baseUrl}${path}`, { waitUntil: "load" });
    const loadMs = Date.now() - startedAt;

    // A route that bounced to sign-in produces a screenshot that looks fine and
    // proves nothing, so say so loudly rather than writing it.
    if (new URL(page.url()).pathname === "/signin") {
      console.error(`FAILED ${path}: redirected to /signin, session not held`);
      failed += 1;
      continue;
    }

    const out = `${outDir}/${name}-${width}.png`;
    await page.screenshot({ path: out, fullPage: true });
    console.log(`${path} loaded in ${loadMs}ms, wrote ${out}`);
  } catch (error) {
    console.error(`FAILED ${path}: ${error.message}`);
    failed += 1;
  } finally {
    await page.close();
  }
}

await browser.close();
process.exit(failed > 0 ? 1 : 0);
