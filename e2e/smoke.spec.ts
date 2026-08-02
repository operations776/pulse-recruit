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

test("every pillar module renders", async ({ page }) => {
  const modules: [string, string][] = [
    ["/market", "BD engine"],
    ["/ops", "Morning brief"],
    ["/ops/tasks", "Tasks"],
    ["/sequences", "Sequences"],
    ["/mailboxes", "Mailboxes"],
    ["/content", "Content planner"],
    ["/content/skills", "Skills"],
  ];

  for (const [href, heading] of modules) {
    await page.goto(href);
    await expect(page.getByRole("heading", { name: heading, level: 1 })).toBeVisible();
  }
});

test("the module rail names all five pillars", async ({ page }) => {
  await page.goto("/pipeline/j_1");
  for (const wordmark of ["MARKET", "OPS", "OUTBOUND", "TALENT", "CONTENT"]) {
    await expect(
      page.getByRole("link", { name: `${wordmark} module` }),
    ).toBeVisible();
  }
});
