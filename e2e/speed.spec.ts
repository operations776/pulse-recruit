import { expect, test } from "@playwright/test";

// Speed budget from ARCHITECTURE.md. Speed is a feature: "if you open Stardex or
// any ATS, it has to be fast." A PR that regresses this fails CI on purpose.
const BUDGET_MS = 300;

const routes = ["/", "/design"];

for (const route of routes) {
  test(`${route} responds inside the speed budget`, async ({ page }) => {
    await page.goto(route, { waitUntil: "domcontentloaded" });

    const timing = await page.evaluate(() => {
      const nav = performance.getEntriesByType(
        "navigation",
      )[0] as PerformanceNavigationTiming;
      return {
        response: nav.responseEnd - nav.requestStart,
        domContentLoaded: nav.domContentLoadedEventEnd - nav.startTime,
      };
    });

    expect(
      timing.response,
      `${route} server response was ${Math.round(timing.response)}ms, budget ${BUDGET_MS}ms`,
    ).toBeLessThan(BUDGET_MS);
  });
}

test("no layout shift on the design sheet", async ({ page }) => {
  await page.goto("/design");

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
