import { expect, test } from "@playwright/test";

test("home renders the product name", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Pulse").first()).toBeVisible();
});

test("design sheet renders the pipeline board", async ({ page }) => {
  await page.goto("/design");
  await expect(
    page.getByRole("heading", { name: "Pipeline", level: 1 }),
  ).toBeVisible();
  await expect(page.getByText("Sarah Chen").first()).toBeVisible();
});
