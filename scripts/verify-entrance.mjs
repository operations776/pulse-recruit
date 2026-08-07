// Prove the landing page's focal entrance runs, once, and collapses.
//
// DESIGN.md 10a permits exactly one authored entrance per marketing page, up
// to 800ms, on first load only, and reduced motion must still collapse it.
// None of those four properties is visible in a screenshot, and a class name
// on an element proves none of them either: an animation that moves nothing
// still has its class.
//
// Usage: node scripts/verify-entrance.mjs <baseUrl>
import { chromium } from "@playwright/test";

const baseUrl = process.argv[2] ?? "http://localhost:3000";
const browser = await chromium.launch();
let failures = 0;

const check = (label, ok, detail = "") => {
  if (!ok) failures += 1;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
};

// 1. It runs, it is bounded, and it actually moves something.
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });

  const info = await page.evaluate(async () => {
    // Read while it is still in flight, so a no-op animation is caught.
    // Match on the keyframe name, not the class string: className on an
    // SVG or a non-HTML element is not a string, and `.includes` on it throws
    // inside the page and silently yields zero matches.
    const mounted = document
      .getAnimations()
      .filter((a) => String(a.animationName ?? "").startsWith("mount"));
    const timings = mounted.map((a) => {
      const t = a.effect.getComputedTiming();
      return { duration: t.duration, delay: t.delay, iterations: t.iterations };
    });
    const el = document.querySelector(".mount-1");
    const before = el ? getComputedStyle(el).transform : null;
    await Promise.all(mounted.map((a) => a.finished.catch(() => {})));
    const after = el ? getComputedStyle(el).transform : null;
    return { count: mounted.length, timings, before, after };
  });

  check("the entrance runs", info.count > 0, `${info.count} animations`);
  const longest = Math.max(0, ...info.timings.map((t) => t.duration + t.delay));
  check("bounded to 800ms (DESIGN.md 10a)", longest <= 800, `${longest}ms`);
  check(
    "it is not a loop",
    info.timings.every((t) => Number.isFinite(t.iterations)),
  );
  check(
    "it actually moves something",
    info.before !== info.after,
    `${info.before} -> ${info.after}`,
  );
  await page.close();
}

// 2. Reduced motion collapses it. The global rule takes durations to 0.01ms,
//    so the element must be settled essentially immediately.
{
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  await page.goto(baseUrl, { waitUntil: "load" });
  const settled = await page.evaluate(() => {
    const el = document.querySelector(".mount-1");
    if (!el) return null;
    const t = getComputedStyle(el).transform;
    return { transform: t, opacity: getComputedStyle(el).opacity };
  });
  check(
    "reduced motion lands it immediately",
    settled !== null &&
      (settled.transform === "none" || settled.transform.includes("0, 0")) &&
      Number(settled.opacity) > 0.9,
    JSON.stringify(settled),
  );
  await context.close();
}

await browser.close();
process.exit(failures ? 1 : 0);
