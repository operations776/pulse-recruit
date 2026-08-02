import { expect, test } from "@playwright/test";

// The point of these is that the UI actually works, not just that it renders.

test("selecting candidates reveals the bulk bar and Esc clears it", async ({
  page,
}) => {
  await page.goto("/pipeline/j_1");

  await page.getByRole("button", { name: "Select Laurie Kessler" }).click();
  await expect(page.getByText("1 selected")).toBeVisible();

  await page.getByRole("button", { name: "Select Berry Shields" }).click();
  await expect(page.getByText("2 selected")).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(page.getByText("2 selected")).toBeHidden();
});

test("bulk move relocates candidates and reports an honest count", async ({
  page,
}) => {
  await page.goto("/pipeline/j_1");

  await page.getByRole("button", { name: "Select Laurie Kessler" }).click();
  await page.getByRole("button", { name: "Move" }).click();
  await page.getByRole("button", { name: "Offer", exact: true }).click();

  await expect(page.getByText("Moved 1 candidate to Offer")).toBeVisible();
  await expect(page.getByText("1 selected")).toBeHidden();
});

test("opening a candidate and adding a note updates the drawer in place", async ({
  page,
}) => {
  await page.goto("/pipeline/j_1");

  await page.getByRole("button", { name: "Open Clementine Spencer" }).click();
  const drawer = page.getByRole("complementary", {
    name: "Clementine Spencer details",
  });
  await expect(drawer).toBeVisible();

  await drawer.getByRole("button", { name: /notes/i }).click();
  await drawer.getByLabel("New note").fill("Portfolio review booked for Thursday.");
  await drawer.getByRole("button", { name: "Add note" }).click();

  // The drawer must survive the write. Remounting it here is the
  // revalidatePath-in-an-open-layer bug that CLAUDE.md forbids.
  await expect(drawer).toBeVisible();
  await expect(
    drawer.getByText("Portfolio review booked for Thursday."),
  ).toBeVisible();
});

test("moving a stage from the drawer works", async ({ page }) => {
  await page.goto("/pipeline/j_1");

  await page.getByRole("button", { name: "Open Berry Shields" }).click();
  const drawer = page.getByRole("complementary", { name: "Berry Shields details" });
  await drawer.getByRole("button", { name: "Interview", exact: true }).click();

  await expect(page.getByText("Berry Shields moved to Interview")).toBeVisible();
});

test("add candidate rejects a duplicate email on the same role", async ({
  page,
}) => {
  await page.goto("/pipeline/j_1");

  await page.getByRole("button", { name: "Add candidate" }).click();
  // Scope to the dialog: Next renders its own role="alert" route announcer.
  const dialog = page.getByRole("dialog", { name: "Add candidate" });
  await dialog.getByLabel("Full name").fill("Someone Else");
  await dialog.getByLabel("Email").fill("c.spencer@fieldstone.com");
  await dialog.getByRole("button", { name: "Add candidate" }).click();

  await expect(dialog.getByRole("alert")).toContainText("already on this role");
});

test("add candidate creates a card on the board", async ({ page }) => {
  await page.goto("/pipeline/j_1");

  await page.getByRole("button", { name: "Add candidate" }).click();
  const dialog = page.getByRole("dialog", { name: "Add candidate" });
  await dialog.getByLabel("Full name").fill("Nina Alvarez");
  await dialog.getByLabel("Email").fill("nina.alvarez@example.com");
  await dialog.getByRole("button", { name: "Add candidate" }).click();

  // Assert on the board card, not the toast, which also carries the name.
  await expect(
    page.getByRole("button", { name: "Open Nina Alvarez" }),
  ).toBeVisible();
});

test("candidate search filters the board", async ({ page }) => {
  await page.goto("/pipeline/j_1");

  await page.getByLabel("Search candidates").fill("Berry");
  await expect(page.getByText("Berry Shields")).toBeVisible();
  await expect(page.getByText("Laurie Kessler")).toBeHidden();
});

test("candidates table filters compose", async ({ page }) => {
  await page.goto("/candidates");

  // Eleanor Taylor is a "Design Lead" at Offer, Laurie Kessler a "Product
  // Designer" at Applied, so the two filters together must keep only Eleanor.
  await page.getByLabel("Search candidates").fill("design");
  await page.getByLabel("Filter by stage").selectOption("Offer");

  await expect(page.getByText("Eleanor Taylor")).toBeVisible();
  await expect(page.getByText("Laurie Kessler")).toBeHidden();
});

test("dismissing a signal removes it from the feed", async ({ page }) => {
  await page.goto("/signals");

  await expect(page.getByText("Raised a $40M Series B")).toBeVisible();
  await page
    .getByRole("button", { name: "Dismiss" })
    .first()
    .click();
  await expect(page.getByText("Raised a $40M Series B")).toBeHidden();
});

test("delete workspace stays disabled until the name matches", async ({
  page,
}) => {
  await page.goto("/settings");

  await page.getByRole("button", { name: "Delete workspace" }).click();
  const confirm = page.getByRole("dialog").getByRole("button", {
    name: /delete/i,
  });
  await expect(confirm).toBeDisabled();

  await page.getByRole("dialog").getByRole("textbox").fill("Nortech Search");
  await expect(confirm).toBeEnabled();
});
