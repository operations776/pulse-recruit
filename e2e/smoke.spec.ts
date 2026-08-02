import { expect, test } from "@playwright/test";

test("home renders the product name", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Pulse").first()).toBeVisible();
});

test("app sheet renders the pipeline board", async ({ page }) => {
  await page.goto("/design");
  await expect(
    page.getByRole("heading", { name: "Senior Product Design", level: 1 }),
  ).toBeVisible();
  await expect(page.getByText("Clementine Spencer")).toBeVisible();
  await expect(page.getByText("2 selected")).toBeVisible();
});

test("marketing sheet renders the hero and pricing", async ({ page }) => {
  await page.goto("/design/landing");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "keeps your pipeline",
  );
  await expect(page.getByText("$50")).toBeVisible();
});
