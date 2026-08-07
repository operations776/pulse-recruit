import { expect, test } from "@playwright/test";

// PLS-112 to PLS-114. Mara's screen.
//
// The three things worth guarding are the ones a screenshot already caught
// once: the stage must survive having conversation history, the ledger must
// round-trip through the database, and no tile may show a number it cannot
// source.

test.beforeEach(async ({ page }) => {
  await page.goto("/signin");
  await page.fill('input[type="email"]', process.env.PULSE_DEMO_EMAIL ?? "daniyal@nortech.io");
  await page.fill('input[type="password"]', process.env.PULSE_DEMO_PASSWORD ?? "pulse-demo-2026");
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => !url.pathname.startsWith("/signin"));
});

test("the stage renders on the module, not just on an empty workspace", async ({
  page,
}) => {
  await page.goto("/market");

  // /market used to auto-open the most recent thread, which collapsed the
  // whole stage for anybody who had ever asked a question. Landing on the
  // module lands on the stage, whatever history exists.
  await expect(page.getByText("You said you'd")).toBeVisible();
  await expect(page.getByText("What moved on your patch")).toBeVisible();
  await expect(page.getByText("Accounts on patch")).toBeVisible();
});

test("BD time is marked pending rather than showing an invented number", async ({
  page,
}) => {
  await page.goto("/market");

  // Nothing in Pulse tracks hours. The tile may say "--" behind a soon badge;
  // it may never say a figure, because that figure would be fiction.
  const tile = page.locator("div", { hasText: /^BD time/ }).last();
  await expect(tile.getByText("soon")).toBeVisible();
  await expect(tile.getByText(/^\d/)).toHaveCount(0);
});

test("a commitment survives a reload and settles through the RPC", async ({
  page,
}) => {
  await page.goto("/market");

  const play = page.getByRole("button", { name: "I'll do this" });
  test.skip((await play.count()) === 0, "no signal on this patch to commit to");

  await play.first().click();
  await expect(page.getByText("On your list")).toBeVisible();

  // The write is the point. An optimistic label proves nothing.
  await page.reload();
  const done = page.getByRole("button", { name: "Done" }).first();
  await expect(done).toBeVisible();

  await done.click();
  await expect(page.getByText("Nothing outstanding")).toBeVisible();
});

test("telling Mara something closes its own gap chip", async ({ page }) => {
  await page.goto("/market");

  await page.getByRole("button", { name: "Tell Mara something" }).first().click();
  const drawer = page.locator('[role="dialog"]');
  await expect(drawer).toBeVisible();

  await drawer.getByRole("button", { name: "Your fee model" }).click();
  await drawer.locator("textarea").fill("25 percent of first year base.");
  await drawer.getByRole("button", { name: "Save", exact: true }).click();
  await expect(drawer).toBeHidden();

  // The amber chip is the gap. It disappears only if the row really landed.
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Add your fee model" }),
  ).toHaveCount(0);
});

test("past conversations are reachable without a third column", async ({
  page,
}) => {
  await page.goto("/market");

  const history = page.getByRole("button", { name: "Past conversations" });
  test.skip((await history.count()) === 0, "no history in this workspace");

  await history.click();
  await expect(page.locator('[role="dialog"]')).toBeVisible();
});
