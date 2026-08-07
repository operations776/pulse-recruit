// Screenshot Mara's two drawers, which no static shot of /market can reach.
//
// Both open from a button in the persona panel or the stage header, so a
// design review of the page never sees them. They also hold the only two
// destructive-ish affordances on the screen, so they are worth looking at.
//
// Usage: node scripts/shot-mara-drawers.mjs <outDir> <baseUrl> <light|dark>
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const [outDir, baseUrl, theme = "light"] = process.argv.slice(2);

if (!outDir || !baseUrl) {
  console.error(
    "usage: node scripts/shot-mara-drawers.mjs <outDir> <baseUrl> <light|dark>",
  );
  process.exit(1);
}

const email = process.env.PULSE_DEMO_EMAIL ?? "daniyal@nortech.io";
const password = process.env.PULSE_DEMO_PASSWORD ?? "pulse-demo-2026";

mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
});

// Seed the theme the way a returning user would have it, before any paint.
await context.addInitScript((value) => {
  window.localStorage.setItem("pulse.theme", value);
}, theme);

const page = await context.newPage();

await page.goto(`${baseUrl}/signin`, { waitUntil: "load" });
await page.fill('input[type="email"]', email);
await page.fill('input[type="password"]', password);
await page.click('button[type="submit"]');
await page.waitForURL((url) => !url.pathname.startsWith("/signin"), {
  timeout: 30_000,
});

await page.goto(`${baseUrl}/market`, { waitUntil: "load" });

for (const [name, label] of [
  ["tell-mara", "Tell Mara something"],
  ["history", "Past conversations"],
]) {
  const trigger = page.getByRole("button", { name: label }).first();
  if ((await trigger.count()) === 0) {
    console.log(`${name} -> no trigger on the page, skipped`);
    continue;
  }
  await trigger.click();
  // The drawer traps focus when it is really open, so waiting on the dialog
  // role proves it mounted rather than just that the click landed.
  await page.waitForSelector('[role="dialog"]', { timeout: 5_000 });
  // The drawer fades and slides in over 200ms. Shooting the moment it mounts
  // catches it mid-fade and makes an opaque panel look transparent, which is
  // indistinguishable from the real bug it would be hiding.
  await page
    .locator('[role="dialog"]')
    .evaluate((node) =>
      Promise.all(node.getAnimations().map((a) => a.finished)),
    );
  const out = `${outDir}/${name}-${theme}.png`;
  await page.screenshot({ path: out });
  console.log(`${name} -> ${out}`);
  await page.keyboard.press("Escape");
  await page.waitForSelector('[role="dialog"]', {
    state: "detached",
    timeout: 5_000,
  });
}

await browser.close();
