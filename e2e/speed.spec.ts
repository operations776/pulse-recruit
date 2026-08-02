import { expect, test } from "@playwright/test";

// Speed budget from ARCHITECTURE.md. Speed is a feature: "if you open Stardex or
// any ATS, it has to be fast." A PR that regresses this fails CI on purpose.
//
// Measured as the MEDIAN of several samples, not a single navigation. One sample
// on a freshly started server measures process cold start (~2s) and contention
// from parallel workers, neither of which a user experiences. Isolated, these
// routes answer in 20 to 35ms, so the budget has real headroom and a failure
// here means an actual regression rather than a noisy machine.
// Serialized so the samples do not race each other on the same server.
test.describe.configure({ mode: "serial" });

const BUDGET_MS = 300;
const SAMPLES = 5;

const routes = ["/", "/signin"];

const median = (values: number[]) =>
  [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];

for (const route of routes) {
  test(`${route} responds inside the speed budget`, async ({ page }) => {
    const samples: number[] = [];

    for (let i = 0; i < SAMPLES + 1; i += 1) {
      await page.goto(route, { waitUntil: "domcontentloaded" });
      const response = await page.evaluate(() => {
        const nav = performance.getEntriesByType(
          "navigation",
        )[0] as PerformanceNavigationTiming;
        return nav.responseEnd - nav.requestStart;
      });
      // Discard the first, it carries cold start.
      if (i > 0) samples.push(response);
    }

    const result = median(samples);
    expect(
      result,
      `${route} median server response was ${Math.round(result)}ms over ${SAMPLES} samples, budget ${BUDGET_MS}ms. Samples: ${samples.map(Math.round).join(", ")}`,
    ).toBeLessThan(BUDGET_MS);
  });
}

test("no layout shift on the marketing page", async ({ page }) => {
  await page.goto("/");

  const cls = await page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        let total = 0;
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries() as (PerformanceEntry & {
            value: number;
            hadRecentInput: boolean;
          })[]) {
            if (!entry.hadRecentInput) total += entry.value;
          }
        }).observe({ type: "layout-shift", buffered: true });
        setTimeout(() => resolve(total), 1000);
      }),
  );

  expect(cls, `cumulative layout shift was ${cls}`).toBeLessThan(0.1);
});
