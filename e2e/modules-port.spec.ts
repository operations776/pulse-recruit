import { expect, test, type Page } from "@playwright/test";

// PLS-73..78. The module-spec ports: tasks, and the public application link.
//
// These write real rows to the demo org. The apply test cleans up its
// candidate through the bulk bar; the tasks test completes its task rather
// than deleting it, because tasks deliberately have no delete.
const DEMO = { email: "daniyal@nortech.io", password: "pulse-demo-2026" };

async function signIn(page: Page) {
  await page.goto("/signin");
  await page.getByLabel("Email").fill(DEMO.email);
  await page.getByLabel("Password").fill(DEMO.password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(/\/(pipeline|candidates)/, { timeout: 30_000 });
}

test("a task arrives whole: assigned, prioritised, dated, then completed", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/ops/tasks");

  const title = `Spec task ${Date.now()}`;

  // The always-mounted add row: title, assignee (defaults to you), priority.
  // exact, because the sort header also answers to "Priority".
  await page.getByLabel("New task title").fill(title);
  await page.getByLabel("Priority", { exact: true }).selectOption("high");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByText(title)).toBeVisible({ timeout: 15_000 });

  // Assigned to me by default, so it lives on the Mine view, and the row's
  // status control is live.
  const statusSelect = page.getByLabel(/Status of TASK-/).last();
  await expect(statusSelect).toBeVisible();

  // Complete it through the checkbox; it moves under Completed.
  await page.getByRole("checkbox", { name: `Complete ${title}` }).click();
  await expect(
    page.getByRole("checkbox", { name: `Reopen ${title}` }),
  ).toBeVisible({ timeout: 15_000 });
});

test("the everyone view groups open tasks per person", async ({ page }) => {
  await signIn(page);
  await page.goto("/ops/tasks");

  await page.getByRole("button", { name: "Everyone" }).click();
  // The demo org has one member, so the visible group header is You. exact
  // text also matches a hidden option inside the assignee select, so the
  // assertion filters to what a person can actually see.
  await expect(
    page.getByText("You", { exact: true }).locator("visible=true").first(),
  ).toBeVisible();
});

test("the application link mints, takes an application, and revokes", async ({
  page,
  browser,
}) => {
  // This test walks a mint, two submissions, a board check, a delete and a
  // revoke against the shared server while seven other workers hammer it. The
  // default 30s is a contention timeout, not a behaviour signal.
  test.setTimeout(90_000);
  await signIn(page);
  await page.goto("/pipeline");
  await page.waitForURL(/\/pipeline\/.+/, { timeout: 30_000 });

  // Mint the link and read the slug off the copy control.
  await page
    .getByRole("button", { name: "Create a public application link" })
    .click();
  await expect(
    page.getByRole("button", { name: "Copy the application link" }),
  ).toBeVisible({ timeout: 15_000 });

  // The URL lives in the job row now; read it from the database-backed page by
  // copying via clipboard permission-free route: revisit the page and pull the
  // slug from a fresh anonymous context via the copy button's clipboard write.
  const context = await browser.newContext();
  await context.grantPermissions([]);

  // Pull the slug through the authed page's clipboard instead.
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.getByRole("button", { name: "Copy the application link" }).click();
  const url = await page.evaluate(() => navigator.clipboard.readText());
  expect(url).toContain("/apply/");

  // An anonymous visitor applies.
  const anon = await context.newPage();
  const applicant = `Spec Applicant ${Date.now()}`;
  const email = `spec-${Date.now()}@example.com`;
  await anon.goto(url);
  await expect(anon.getByRole("heading", { level: 1 })).toBeVisible();
  await anon.getByLabel(/full name/i).fill(applicant);
  await anon.getByLabel(/email/i).fill(email);
  await anon.getByRole("button", { name: /apply for this role/i }).click();
  await expect(anon.getByText(/application received/i)).toBeVisible({
    timeout: 15_000,
  });

  // Applying twice is a quiet success, never a leak of who already applied.
  await anon.goto(url);
  await anon.getByLabel(/full name/i).fill(applicant);
  await anon.getByLabel(/email/i).fill(email);
  await anon.getByRole("button", { name: /apply for this role/i }).click();
  await expect(anon.getByText(/application received/i)).toBeVisible({
    timeout: 15_000,
  });

  // The applicant landed on the board.
  await page.reload();
  await expect(page.getByText(applicant).first()).toBeVisible({
    timeout: 15_000,
  });

  // Clean up: the card carries a visible select control, then the bulk bar
  // deletes with a two-step confirm.
  await page.getByRole("button", { name: `Select ${applicant}` }).click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await page.getByRole("button", { name: /delete 1 candidate/i }).click();
  await expect(page.getByText(applicant)).toHaveCount(0, { timeout: 15_000 });

  // Revoke, and the link dies for everyone holding it.
  await page.getByRole("button", { name: "Revoke the application link" }).click();
  await expect(
    page.getByRole("button", { name: "Create a public application link" }),
  ).toBeVisible({ timeout: 15_000 });
  await anon.goto(url);
  await expect(anon.getByText(/404|not found/i).first()).toBeVisible();

  await context.close();
});
