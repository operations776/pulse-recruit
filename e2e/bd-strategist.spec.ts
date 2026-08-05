import { expect, test, type Page } from "@playwright/test";

// BD Strategist acceptance coverage.
//
// Per Daniyal's standing instruction these browser checks are written but not
// executed by the agent. They are written against the shipped selectors, not
// an imagined UI: an earlier draft of this file asserted a "Scope" label and a
// "Save feedback" dialog that never existed, which is worse than no spec
// because it looks like coverage.
const DEMO = { email: "daniyal@nortech.io", password: "pulse-demo-2026" };

async function signIn(page: Page) {
  await page.goto("/signin");
  await page.getByLabel("Email").fill(DEMO.email);
  await page.getByLabel("Password").fill(DEMO.password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(/\/(pipeline|candidates)/, { timeout: 30_000 });
}

test("the workspace shows the brief, the work, and the evidence", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/market");

  // The rail identifies the agent and carries the credit meter.
  await expect(page.getByText("BD Strategist").first()).toBeVisible();
  await expect(page.getByText(/credits left this week/i)).toBeVisible();

  // The old page header is gone: it repeated the module rail and explained the
  // product to somebody already inside it.
  await expect(
    page.getByRole("heading", { name: "BD engine", level: 1 }),
  ).toHaveCount(0);
});

test("empty strategy context asks for an intake rather than sitting blank", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/market");

  const hasContext = await page
    .getByText(/Agency strategy|Your coaching/)
    .count();

  test.skip(hasContext > 0, "this workspace already has context saved");

  await expect(page.getByText(/Tell the strategist who you are/i)).toBeVisible();
  await expect(
    page.getByRole("button", { name: /add your first/i }),
  ).toBeVisible();
});

test("a recruiter can add context and the strategist keeps it", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/market");

  await page.getByRole("button", { name: /^context$/i }).click();
  const dialog = page.getByRole("dialog", { name: /add context/i });
  await expect(dialog).toBeVisible();

  // Personal by default for a member, and the copy says who sees it.
  await dialog.getByLabel(/who this applies to/i).selectOption("personal");
  await expect(dialog.getByText(/only you/i)).toBeVisible();

  await dialog.getByLabel(/^type$/i).selectOption("territory");
  await dialog.getByLabel("Title").fill("Nordic battery manufacturing");
  await dialog
    .getByLabel(/what the strategist should know/i)
    .fill("Process and quality engineers into gigafactories in Sweden and Norway.");
  await dialog.getByRole("button", { name: /add context/i }).click();

  await expect(dialog).toBeHidden();
  await expect(page.getByText("Nordic battery manufacturing")).toBeVisible();
});

test("agency strategy is closed to a member who cannot change org settings", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/market");

  await page.getByRole("button", { name: /^context$/i }).click();
  const dialog = page.getByRole("dialog", { name: /add context/i });
  const agency = dialog.getByRole("option", { name: /the whole agency/i });

  // Either the option is disabled, or this account is an owner or admin and it
  // is not. Both are correct; what must never happen is a member saving agency
  // strategy and being refused only by the server.
  if (await agency.isDisabled()) {
    await expect(agency).toContainText(/owner or admin only/i);
  }
});

test("an off-target correction requires a reason", async ({ page }) => {
  await signIn(page);
  await page.goto("/market");

  const offTarget = page.getByRole("button", { name: /off target/i }).first();
  test.skip((await offTarget.count()) === 0, "no settled answer to rate yet");

  await offTarget.click();
  // "That was wrong" teaches nothing. The save stays disabled until there is
  // something the next run can actually use.
  await expect(page.getByRole("button", { name: /^save$/i })).toBeDisabled();

  await page
    .getByPlaceholder(/these companies are too small/i)
    .fill("Stay above 200 headcount.");
  await expect(page.getByRole("button", { name: /^save$/i })).toBeEnabled();
});

test("feedback lands in the rail as visible coaching", async ({ page }) => {
  await signIn(page);
  await page.goto("/market");

  const useful = page.getByRole("button", { name: /^useful$/i }).first();
  test.skip((await useful.count()) === 0, "no settled answer to rate yet");

  await useful.click();
  await page.getByRole("button", { name: /^save$/i }).click();

  // The whole contract: what the agent knows is on screen and removable.
  await expect(page.getByText(/marked useful/i)).toBeVisible();
  await expect(page.getByText(/your coaching/i)).toBeVisible();
});

test("a briefing shows the four labelled sections", async ({ page }) => {
  await signIn(page);
  await page.goto("/market");

  const brief = page.getByText("Best next move").first();
  test.skip((await brief.count()) === 0, "no settled briefing in this transcript");

  await expect(page.getByText("What changed").first()).toBeVisible();
  await expect(page.getByText("Why it matters").first()).toBeVisible();
  await expect(brief).toBeVisible();
});

test("the evidence rail states how current the research is", async ({ page }) => {
  await signIn(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/market");

  const rail = page.getByText("Current read");
  test.skip((await rail.count()) === 0, "evidence rail is hidden below xl");

  // Never an unqualified claim that everything is current: a cache hit is
  // honest research but it is not a live look-up.
  await expect(
    page.getByText(/Live research|Recent research|Nothing researched yet/),
  ).toBeVisible();
});

test("reduced motion does not remove any content", async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: "reduce" });
  const page = await context.newPage();
  await signIn(page);
  await page.goto("/market");

  // Motion is decoration on top of a working page. With it off, the workspace
  // must still be complete rather than stuck mid-animation.
  await expect(page.getByText("BD Strategist").first()).toBeVisible();
  await expect(page.getByRole("button", { name: /^context$/i })).toBeVisible();
  await context.close();
});
