// Product screenshots for the marketing site, generated rather than pasted.
//
// The team rejected screenshots once, for a real reason: they go stale on every
// UI change. That objection is answered by making them a command instead of an
// artefact. Re-run this after a UI change and the site is current; the files
// land at fixed paths so no markup has to change.
//
// Rules these follow, so the page stays honest:
//   - the seeded demo workspace only, never a real client's data
//   - both themes, so the image matches the visitor's mode
//   - fixed dimensions, so <Image> can reserve the space and nothing shifts
//
// Usage: node scripts/shot-marketing.mjs [baseUrl]
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const baseUrl = process.argv[2] ?? "http://localhost:3000";
const email = process.env.PULSE_DEMO_EMAIL ?? "daniyal@nortech.io";
const password = process.env.PULSE_DEMO_PASSWORD ?? "pulse-demo-2026";

// Wide enough to read, short enough that the crop is a screen rather than a
// scroll. These numbers are the contract with the markup: change them here and
// change the width/height props with them.
const WIDTH = 1440;
// 500, not the 900 viewport. A seeded workspace does not fill a full screen,
// so a viewport-height shot is mostly empty ground, and on the landing page
// that reads as a product with nothing in it. 620 was still too tall; checked
// against the rendered page rather than guessed.
const HEIGHT = 500;

// What the landing page shows. Each entry is a claim the page makes, paired
// with the screen that proves it.
// /market is deliberately NOT here.
//
// The demo workspace has no model key, so the BD screen photographs with a
// large amber "Pulse has no model configured yet" banner as its most prominent
// element. A marketing screenshot whose loudest word is NOT AVAILABLE is worse
// than no screenshot. It goes back in when the demo workspace can answer.
const SHOTS = [
  { path: "/ops/tasks", name: "tasks", proves: "one list of what the team owes" },
  { path: "/content", name: "content", proves: "the content planner" },
];

const out = "public/shots";
mkdirSync(out, { recursive: true });

const browser = await chromium.launch();

for (const theme of ["light", "dark"]) {
  const context = await browser.newContext({
    viewport: { width: WIDTH, height: HEIGHT },
    // Retina, because a 1x screenshot of dense UI is unreadable once the page
    // scales it down into a frame.
    deviceScaleFactor: 2,
  });
  await context.addInitScript((v) => {
    window.localStorage.setItem("pulse.theme", v);
  }, theme);

  const page = await context.newPage();
  await page.goto(`${baseUrl}/signin`, { waitUntil: "load" });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.startsWith("/signin"), {
    timeout: 30_000,
  });

  for (const shot of SHOTS) {
    await page.goto(`${baseUrl}${shot.path}`, { waitUntil: "load" });

    // Let entry animations finish, or a card is caught mid-fade and the
    // marketing site ships a picture of a half-rendered screen. Finite
    // animations only: the pulse dot never settles.
    await page
      .evaluate(
        () =>
          new Promise((resolve) => {
            const finite = document
              .getAnimations()
              .filter((a) =>
                Number.isFinite(a.effect?.getComputedTiming().iterations ?? 1),
              )
              .map((a) => a.finished.catch(() => {}));
            const timer = setTimeout(resolve, 1200);
            Promise.all(finite).then(() => {
              clearTimeout(timer);
              resolve(undefined);
            });
          }),
      )
      .catch(() => {});

    const file = `${out}/${shot.name}-${theme}.png`;
    await page.screenshot({ path: file });
    console.log(`${shot.path} (${theme}) -> ${file}  [${shot.proves}]`);
  }

  await context.close();
}

await browser.close();
console.log(`\nDone. ${SHOTS.length * 2} images at ${WIDTH}x${HEIGHT}@2x.`);
