// Screenshot a signed-in route in a chosen theme, for design review.
//
// scripts/shot-app.mjs signs in and shoots the default (light) theme. Dark mode
// is a per-device preference in localStorage, so proving it works means seeding
// that preference the way a returning user would have it, then checking the
// attribute and the computed background actually followed.
//
// Usage: node scripts/shot-theme.mjs <outDir> <baseUrl> <light|dark> <path> [path...]
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const [outDir, baseUrl, theme, ...paths] = process.argv.slice(2);

if (!outDir || !baseUrl || !theme || paths.length === 0) {
  console.error(
    "usage: node scripts/shot-theme.mjs <outDir> <baseUrl> <light|dark> <path> [path...]",
  );
  process.exit(1);
}

const width = Number(process.env.PULSE_SHOT_WIDTH ?? 1440);
const height = Number(process.env.PULSE_SHOT_HEIGHT ?? 1000);
const email = process.env.PULSE_DEMO_EMAIL ?? "daniyal@nortech.io";
const password = process.env.PULSE_DEMO_PASSWORD ?? "pulse-demo-2026";

mkdirSync(outDir, { recursive: true });

// A container or CI image often ships one Chromium that the pinned Playwright
// does not expect, and the launch fails on a path rather than on anything real.
// Point PULSE_CHROMIUM at it instead of reinstalling browsers.
const executablePath = process.env.PULSE_CHROMIUM;
const browser = await chromium.launch(executablePath ? { executablePath } : {});
const context = await browser.newContext({
  viewport: { width, height },
  deviceScaleFactor: 2,
});
const page = await context.newPage();

// The component sheet at /design is public and holds no tenant data, so
// signing in to photograph it is a round trip that buys nothing and needs
// credentials this run may not have. Everything inside the product still
// signs in.
const isPublic = process.env.PULSE_SHOT_PUBLIC === "1";

// Seed the preference on the right origin before the first real navigation, so
// every load below is a returning-user load rather than a toggle we clicked.
await page.goto(`${baseUrl}${isPublic ? paths[0] : "/signin"}`);
await page.evaluate((t) => localStorage.setItem("pulse.theme", t), theme);

if (!isPublic) {
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(/\/(pipeline|candidates)/, { timeout: 30_000 });
}

for (const path of paths) {
  await page.goto(`${baseUrl}${path}`);
  await page.waitForLoadState("networkidle");

  const applied = await page.evaluate(() => ({
    attr: document.documentElement.getAttribute("data-theme"),
    bg: getComputedStyle(document.body).backgroundColor,
  }));

  const name = path.replace(/\W+/g, "-").replace(/^-|-$/g, "") || "root";
  const file = `${outDir}/${name}-${theme}.png`;
  await page.screenshot({ path: file });

  // Report what actually applied. A screenshot alone cannot prove the
  // attribute is set rather than the colours being coincidental.
  console.log(`${path} -> data-theme=${applied.attr} bg=${applied.bg} ${file}`);
}

await browser.close();
