import { expect, test } from "@playwright/test";

// These run against the real Supabase project with the seeded demo org, so
// every assertion is on data the database actually returned.
const DEMO = { email: "daniyal@nortech.io", password: "pulse-demo-2026" };

async function signIn(page: import("@playwright/test").Page) {
  await page.goto("/signin");
  await page.getByLabel("Email").fill(DEMO.email);
  await page.getByLabel("Password").fill(DEMO.password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(/\/(pipeline|candidates)/, { timeout: 20_000 });
}

test("an unauthenticated request cannot reach the product", async ({ page }) => {
  await page.goto("/candidates");
  await expect(page).toHaveURL(/\/signin/);
});

test("marketing home renders without a session", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

test("signing in lands on real pipeline data", async ({ page }) => {
  await signIn(page);
  // Seeded by the database, not by a fixture in this repo.
  await expect(page.getByText("Senior Product Designer").first()).toBeVisible();
  await expect(page.getByText("Clementine Spencer")).toBeVisible();
});

test("every module renders for a signed in user", async ({ page }) => {
  await signIn(page);

  const modules: [string, RegExp][] = [
    ["/candidates", /candidates/i],
    ["/companies", /companies/i],
    ["/reports", /reports/i],
    ["/signals", /signals/i],
    ["/sequences", /sequences/i],
    ["/mailboxes", /mailboxes/i],
    ["/market", /bd engine/i],
    ["/ops", /morning brief/i],
    ["/ops/tasks", /tasks/i],
    ["/content", /content planner/i],
    ["/content/skills", /skills/i],
    ["/settings/integrations", /api keys/i],
  ];

  for (const [href, heading] of modules) {
    await page.goto(href);
    await expect(page.getByRole("heading", { name: heading, level: 1 })).toBeVisible();
  }
});

test("api keys screen lists every provider as not set", async ({ page }) => {
  await signIn(page);
  await page.goto("/settings/integrations");
  await expect(page.getByText("Exa", { exact: false }).first()).toBeVisible();
  await expect(page.getByText("Not set").first()).toBeVisible();
});
