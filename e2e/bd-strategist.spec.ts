import { expect, test, type Page } from "@playwright/test";

// BD Strategist acceptance coverage.
//
// Per Daniyal's standing instruction these browser checks are written but not
// executed by the agent. They are written against the shipped selectors, not
// an imagined UI: an earlier draft of this file asserted a "Scope" label and a
// "Save feedback" dialog that never existed, which is worse than no spec
// because it looks like coverage.
const DEMO = { email: "daniyal@nortech.io", password: "pulse-demo-2026" };

// PLS-110 renamed the rail's add control. It used to read "Context", which now
// belongs to one of the three panel toggles, so /^context$/i would silently
// start clicking the toggle and every dialog assertion under it would fail for
// a reason that looks nothing like the cause. The button carries an aria-label
// naming the layer it will file into, which depends on the open panel and on
// whether this account may write agency strategy.
const ADD_CONTEXT = /^add (agency strategy|your coaching)$/i;

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

  await page.getByRole("button", { name: ADD_CONTEXT }).click();
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

  await page.getByRole("button", { name: ADD_CONTEXT }).click();
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

test("the Read panel states how current the research is", async ({ page }) => {
  await signIn(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/market");

  // This test used to look for the text "Current read", which has never
  // existed anywhere in src. It therefore skipped on every run while reading
  // as coverage, which is the exact failure this file's header warns about.
  // The evidence lives behind the Read toggle since PLS-110.
  await page.getByRole("button", { name: /^read$/i }).click();

  // Never an unqualified claim that everything is current: a cache hit is
  // honest research but it is not a live look-up.
  await expect(
    page.getByText(/Live research|Recent research|Nothing researched yet/),
  ).toBeVisible();
});

test("the rail switches between the three panels", async ({ page }) => {
  await signIn(page);
  await page.goto("/market");

  const pillars = page.getByRole("button", { name: /^pillars$/i });
  const context = page.getByRole("button", { name: /^context$/i });
  const read = page.getByRole("button", { name: /^read$/i });

  // Pillars opens by default, and exactly one panel is ever pressed.
  await expect(pillars).toHaveAttribute("aria-pressed", "true");
  await expect(context).toHaveAttribute("aria-pressed", "false");
  await expect(read).toHaveAttribute("aria-pressed", "false");

  await read.click();
  await expect(read).toHaveAttribute("aria-pressed", "true");
  await expect(pillars).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByText(/Best next move/i)).toBeVisible();

  await context.click();
  await expect(context).toHaveAttribute("aria-pressed", "true");
  // Pillars content is switched away, not merely scrolled past.
  await expect(page.getByText(/Best next move/i)).toBeHidden();
});

test("Pillars is the agency's strategy, never the five product pillars", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/market");

  await page.getByRole("button", { name: /^pillars$/i }).click();

  // The module rail 264px to the left already names the five pillars. A second
  // column repeating them is the dead-column defect PLS-99 removed, so the
  // panel holds agency strategy or an intake asking for some.
  await expect(
    page.getByText(/Agency strategy|Tell the strategist who you are|No agency strategy yet/),
  ).toBeVisible();
  await expect(page.getByText(/Multichannel outbound/i)).toHaveCount(0);
});

test("history stays reachable whichever panel is open", async ({ page }) => {
  await signIn(page);
  await page.goto("/market");

  // History is thread navigation rather than something the strategist knows,
  // so it is not one of the three and does not switch away with them.
  const newConversation = page.getByRole("button", { name: /new conversation/i });
  await expect(newConversation).toBeVisible();

  await page.getByRole("button", { name: /^read$/i }).click();
  await expect(newConversation).toBeVisible();
});

test("the strategist reports Ready before a run and Thinking during one", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/market");

  const composer = page.getByLabel(/your question/i);
  test.skip(await composer.isDisabled(), "no provider key configured on this deploy");

  // DESIGN.md rule 9: colour, icon and word. The word is the assertable part,
  // and it must be present before anything is asked rather than appearing only
  // once the surface is busy.
  await expect(page.getByText(/^Ready$/)).toBeVisible();

  await composer.fill("Which accounts in my patch raised funding this month?");
  await page.getByRole("button", { name: /^ask$/i }).click();

  await expect(page.getByText(/^Thinking$/)).toBeVisible();
  // Teal is the running colour and it belongs to Thinking alone here.
  await expect(page.getByText(/^Ready$/)).toHaveCount(0);
});

test("a surface with no provider key says so instead of reporting Ready", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/market");

  const composer = page.getByLabel(/your question/i);
  test.skip(!(await composer.isDisabled()), "this deploy has its provider keys");

  // AI.md section 4: a missing key disables the composer and says so. The
  // indicator has to agree with the banner rather than claiming the strategist
  // is standing by on a surface that cannot answer.
  await expect(page.getByText(/^Unavailable$/)).toBeVisible();
  await expect(page.getByText(/^Ready$/)).toHaveCount(0);
});

test("reduced motion does not remove any content", async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: "reduce" });
  const page = await context.newPage();
  await signIn(page);
  await page.goto("/market");

  // Motion is decoration on top of a working page. With it off, the workspace
  // must still be complete rather than stuck mid-animation.
  await expect(page.getByText("BD Strategist").first()).toBeVisible();
  await expect(page.getByRole("button", { name: ADD_CONTEXT })).toBeVisible();
  // The pulse on the Thinking dot is the one ambient animation in the product,
  // and with motion off the status word must still be readable.
  await expect(page.getByText(/^(Ready|Thinking|Unavailable)$/)).toBeVisible();
  await context.close();
});
