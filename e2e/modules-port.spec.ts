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

// PLS-111 rewrote this screen, and these two tests with it. The always-mounted
// add row with its four controls is gone: one typed sentence carries the title,
// the date and the priority, and the reads-as row is what proves the server and
// the browser read it the same way.
test("a typed sentence becomes a whole task, and completing it is undoable", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/ops/tasks");

  const title = `Spec task ${Date.now()}`;

  await page.getByLabel("Add a task").fill(`${title} tomorrow 3pm p1`);

  // The preview is the contract: if these chips are wrong, the row that lands
  // is wrong, and this is the only place a user finds out before committing.
  await expect(page.getByText("Reads as")).toBeVisible();
  await expect(page.getByText("Priority 1", { exact: true })).toBeVisible();
  await expect(page.getByText(/\d{1,2} [A-Z]{3} 15:00/)).toBeVisible();

  await page.getByLabel("Add a task").press("Enter");
  await expect(page.getByText(title)).toBeVisible({ timeout: 15_000 });

  // Complete it. The row stays in place, struck through, with Undo on it.
  await page.getByRole("checkbox", { name: `Complete ${title}` }).click();
  const undo = page.getByRole("button", { name: "Undo" });
  await expect(undo).toBeVisible({ timeout: 5_000 });

  // Undo puts it straight back, and no toast was ever involved.
  await undo.click();
  await expect(
    page.getByRole("checkbox", { name: `Complete ${title}` }),
  ).toBeVisible({ timeout: 15_000 });

  // Complete it for real. It collapses out of the open list after the four
  // second window and reappears under the completed toggle.
  await page.getByRole("checkbox", { name: `Complete ${title}` }).click();
  await page
    .getByRole("button", { name: /show \d+ completed/i })
    .click({ timeout: 20_000 });
  await expect(
    page.getByRole("checkbox", { name: `Reopen ${title}` }),
  ).toBeVisible({ timeout: 15_000 });
});

test("the view rail moves the list, and every view is a URL", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/ops/tasks");

  await page.getByRole("link", { name: /^Everything/ }).click();
  await expect(page).toHaveURL(/view=everything/);
  await expect(page.getByRole("heading", { name: "Everything" })).toBeVisible();

  // The demo org has one member, so By person lists exactly You.
  await page.getByRole("link", { name: /^You/ }).click();
  await expect(page).toHaveURL(/person=/);
});

test("a task opens into the panel and takes a comment", async ({ page }) => {
  await signIn(page);
  await page.goto("/ops/tasks");

  const title = `Spec panel ${Date.now()}`;
  await page.getByLabel("Add a task").fill(`${title} tomorrow`);
  await page.getByLabel("Add a task").press("Enter");
  await expect(page.getByText(title)).toBeVisible({ timeout: 15_000 });

  await page.getByRole("button", { name: title }).click();
  await expect(page).toHaveURL(/task=/);

  // create_task writes the opening line of the stream in the same transaction,
  // so a task can never arrive with an empty activity feed.
  await expect(page.getByText(/Created this/)).toBeVisible({ timeout: 15_000 });

  const note = `Spec comment ${Date.now()}`;
  await page.getByLabel("Comment").fill(note);
  await page.getByRole("button", { name: "Post" }).click();
  await expect(page.getByText(note)).toBeVisible({ timeout: 15_000 });

  // Yours, so all three actions are mounted rather than hidden behind hover.
  await expect(page.getByRole("button", { name: "Edit" }).last()).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(page).not.toHaveURL(/task=/);
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
