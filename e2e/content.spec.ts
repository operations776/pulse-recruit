import { expect, test, type Page } from "@playwright/test";

// PLS-66. These run against the real Supabase project and the seeded demo org,
// so every assertion is on a row the database actually wrote. Each test creates
// its own post with a unique hook and deletes it at the end, because a suite
// that leaves rows behind changes the fixture for the next run.
const DEMO = { email: "daniyal@nortech.io", password: "pulse-demo-2026" };

async function signIn(page: Page) {
  await page.goto("/signin");
  await page.getByLabel("Email").fill(DEMO.email);
  await page.getByLabel("Password").fill(DEMO.password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(/\/(pipeline|candidates)/, { timeout: 30_000 });
}

/** Add a backlog idea and return its hook. */
async function addIdea(page: Page, hook: string) {
  await page.getByRole("button", { name: "New post" }).click();
  await page.getByLabel("Hook").fill(hook);
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByText(hook)).toBeVisible({ timeout: 15_000 });
}

async function deleteViaDrawer(page: Page, hook: string) {
  await page.getByRole("button", { name: hook }).first().click();
  await page.getByRole("button", { name: "Delete post" }).click();
  await page.getByRole("button", { name: "Yes, delete" }).click();
  await expect(page.getByText(hook)).toHaveCount(0, { timeout: 15_000 });
}

test("the planner opens on a calendar with a backlog under it", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/content");

  await expect(
    page.getByRole("heading", { name: /content planner/i, level: 1 }),
  ).toBeVisible();

  // Monday first, and six rows so the grid never changes height between months.
  await expect(page.getByText("Mon", { exact: true })).toBeVisible();
  await expect(page.locator("[data-day]")).toHaveCount(42);
  await expect(page.getByText(/ideas with no date yet/i)).toBeVisible();
});

test("an idea starts in the backlog and a date moves it onto the grid", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/content?month=2026-08");

  const hook = `Spec idea ${Date.now()}`;
  await addIdea(page, hook);

  // Born undated, so it belongs to the backlog and to no square.
  const row = page.locator("li", { hasText: hook });
  await expect(row).toHaveCount(1);

  // The keyboard path to what dragging does. This is the one that has to work:
  // drag alone would leave the feature unusable without a mouse.
  await row.getByRole("button", { name: `Set a date for ${hook}` }).click();
  await row.getByLabel("Date").fill("2026-08-12");
  await row.getByRole("button", { name: "Set", exact: true }).click();

  const cell = page.locator('[data-day="2026-08-12"]');
  await expect(cell.getByText(hook)).toBeVisible({ timeout: 15_000 });
  // and it left the backlog
  await expect(page.locator("li", { hasText: hook })).toHaveCount(0);

  await deleteViaDrawer(page, hook);
});

test("dragging an idea onto a day schedules it", async ({ page }) => {
  await signIn(page);
  await page.goto("/content?month=2026-08");

  const hook = `Drag idea ${Date.now()}`;
  await addIdea(page, hook);

  const ref = await page
    .locator("li", { hasText: hook })
    .getAttribute("data-post");
  expect(ref).toBeTruthy();

  // Playwright's mouse API cannot drive native HTML5 drag and drop, so the
  // events are dispatched for real. React listens at the root, hence bubbles.
  await page.evaluate((postRef) => {
    const source = document.querySelector(`[data-post="${postRef}"]`)!;
    const target = document.querySelector('[data-day="2026-08-19"]')!;
    const dataTransfer = new DataTransfer();

    source.dispatchEvent(
      new DragEvent("dragstart", { dataTransfer, bubbles: true }),
    );
    target.dispatchEvent(
      new DragEvent("dragover", {
        dataTransfer,
        bubbles: true,
        cancelable: true,
      }),
    );
    target.dispatchEvent(
      new DragEvent("drop", { dataTransfer, bubbles: true, cancelable: true }),
    );
  }, ref);

  const cell = page.locator('[data-day="2026-08-19"]');
  await expect(cell.getByText(hook)).toBeVisible({ timeout: 15_000 });

  await deleteViaDrawer(page, hook);
});

test("the drawer copies the post and records that it went out", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await signIn(page);
  await page.goto("/content");

  const hook = `Drawer idea ${Date.now()}`;
  await addIdea(page, hook);

  await page.getByRole("button", { name: hook }).first().click();

  // The frame is the whole point of the skills catalogue: never a blank page.
  await expect(page.getByText("The frame")).toBeVisible();

  const body = `Body written by the spec ${Date.now()}`;
  await page.getByLabel("The post").fill(body);
  await page.getByLabel("Hook").click(); // blur saves

  await page.getByRole("button", { name: "Copy text" }).click();
  await expect(page.getByRole("button", { name: "Copied" })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(body);

  await page.getByRole("button", { name: "Mark published" }).click();
  // The toast says what actually happened. Pulse did not post anything.
  await expect(page.getByText(/you still post it yourself/i)).toBeVisible({
    timeout: 15_000,
  });

  await deleteViaDrawer(page, hook);
});

test("month navigation keeps the same view and moves the grid", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/content?month=2026-08&view=calendar");

  await expect(page.getByText("August 2026")).toBeVisible();
  await page.getByLabel("Next month").click();
  await expect(page.getByText("September 2026")).toBeVisible();
  await expect(page).toHaveURL(/month=2026-09/);
  await expect(page).toHaveURL(/view=calendar/);
});

test("the board shows the same posts arranged by state", async ({ page }) => {
  await signIn(page);
  await page.goto("/content?view=board");

  for (const column of ["Idea", "Drafted", "Scheduled", "Published"]) {
    await expect(page.getByRole("region", { name: column })).toBeVisible();
  }
});
