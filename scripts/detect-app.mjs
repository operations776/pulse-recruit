// Run the impeccable detector over signed-in screens.
//
// `impeccable detect <url>` loads the page itself and cannot sign in, so every
// product screen scans as /signin. This signs in, waits for the screen to
// settle, and writes the rendered DOM plus its computed styles to a standalone
// HTML file the detector can read directly.
//
// Computed styles matter: the detector's contrast and size rules need resolved
// values, and a Tailwind class name tells it nothing. Inlining them is what
// makes a scan of a React app mean anything.
//
// Usage: node scripts/detect-app.mjs <outDir> <baseUrl> [theme] <path...>
import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";

const [outDir, baseUrl, theme, ...paths] = process.argv.slice(2);

if (!outDir || !baseUrl || paths.length === 0) {
  console.error(
    "usage: node scripts/detect-app.mjs <outDir> <baseUrl> <light|dark> <path...>",
  );
  process.exit(1);
}

const width = Number(process.env.PULSE_SHOT_WIDTH ?? 1440);
const height = Number(process.env.PULSE_SHOT_HEIGHT ?? 900);
const email = process.env.PULSE_DEMO_EMAIL ?? "daniyal@nortech.io";
const password = process.env.PULSE_DEMO_PASSWORD ?? "pulse-demo-2026";

mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width, height } });
await context.addInitScript((v) => {
  window.localStorage.setItem("pulse.theme", v);
}, theme ?? "light");

const page = await context.newPage();
await page.goto(`${baseUrl}/signin`, { waitUntil: "load" });
await page.fill('input[type="email"]', email);
await page.fill('input[type="password"]', password);
await page.click('button[type="submit"]');
await page.waitForURL((u) => !u.pathname.startsWith("/signin"), {
  timeout: 30_000,
});

// The properties the detector's rules actually read. Inlining everything would
// produce a file too large to parse and would not improve a single finding.
const PROPS = [
  "color",
  "background-color",
  "background-image",
  "font-family",
  "font-size",
  "font-weight",
  "letter-spacing",
  "line-height",
  "padding",
  "margin",
  "border",
  "border-radius",
  "box-shadow",
  "text-shadow",
  "opacity",
  "display",
  "gap",
];

for (const path of paths) {
  await page.goto(`${baseUrl}${path}`, { waitUntil: "load" });
  // Let ENTRY animations finish, or half-faded elements scan as low contrast.
  //
  // Only the finite ones. The pulse dot and the avatar breathe loop forever,
  // so awaiting every animation's `finished` waits for a promise that never
  // settles and the script hangs with no output at all. Infinite animations
  // are also irrelevant here: they animate opacity and transform, neither of
  // which changes a colour the detector reads.
  await page
    .evaluate(
      () =>
        new Promise((resolve) => {
          const finite = document
            .getAnimations()
            .filter((a) => {
              const iterations = a.effect?.getComputedTiming().iterations ?? 1;
              return Number.isFinite(iterations);
            })
            .map((a) => a.finished.catch(() => {}));
          // Belt and braces: resolve regardless after a second, so one odd
          // animation cannot cost the whole run.
          const timer = setTimeout(resolve, 1000);
          Promise.all(finite).then(() => {
            clearTimeout(timer);
            resolve(undefined);
          });
        }),
    )
    .catch(() => {});

  const html = await page.evaluate((props) => {
    for (const el of Array.from(document.querySelectorAll("*"))) {
      const cs = getComputedStyle(el);
      const decl = props
        .map((p) => `${p}:${cs.getPropertyValue(p)}`)
        .filter((d) => {
          const v = d.split(":").slice(1).join(":").trim();
          return v && v !== "none" && v !== "normal" && v !== "auto";
        })
        .join(";");
      if (decl) el.setAttribute("style", decl);
    }
    return document.documentElement.outerHTML;
  }, PROPS);

  const name = (path === "/" ? "index" : path.replace(/\//g, "-").replace(/^-/, ""))
    .concat(`-${theme ?? "light"}.html`);
  writeFileSync(`${outDir}/${name}`, html);
  console.log(`${path} -> ${outDir}/${name}`);
}

await browser.close();
