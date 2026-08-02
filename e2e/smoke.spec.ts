import { expect, test } from "@playwright/test";

test("marketing home renders the hero and pricing", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "keeps your pipeline",
  );
  await expect(page.getByText("$50")).toBeVisible();
});

test("pipeline board renders stages and candidates", async ({ page }) => {
  await page.goto("/pipeline/j_1");
  await expect(
    page.getByRole("heading", { name: "Senior Product Designer", level: 1 }),
  ).toBeVisible();
  await expect(page.getByText("Clementine Spencer")).toBeVisible();
  await expect(page.getByText("Applied", { exact: true })).toBeVisible();
});

test("candidates table lists every role", async ({ page }) => {
  await page.goto("/candidates");
  await expect(page.getByRole("heading", { name: "Candidates", level: 1 })).toBeVisible();
  await expect(page.getByText("Laurie Kessler")).toBeVisible();
  await expect(page.getByText("Priya Nair")).toBeVisible();
});

test("companies, signals, reports and settings render", async ({ page }) => {
  await page.goto("/companies");
  await expect(page.getByRole("heading", { name: "Companies", level: 1 })).toBeVisible();

  await page.goto("/signals");
  await expect(page.getByRole("heading", { name: "Signals", level: 1 })).toBeVisible();

  await page.goto("/reports");
  await expect(page.getByRole("heading", { name: "Reports", level: 1 })).toBeVisible();

  await page.goto("/settings");
  await expect(page.getByRole("heading", { name: "Settings", level: 1 })).toBeVisible();
});

test("auth screens render", async ({ page }) => {
  await page.goto("/signin");
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();

  await page.goto("/signup");
  await expect(
    page.getByRole("heading", { name: "Create your workspace" }),
  ).toBeVisible();
});
