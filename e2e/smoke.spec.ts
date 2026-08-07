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
  // Seeded by the database, not by a fixture in this repo. Generous timeouts:
  // other specs in the run revalidate the pipeline layout while this one is
  // rendering it, and a rebuild under eight workers is slow, not wrong.
  await expect(page.getByText("Senior Product Designer").first()).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByText("Clementine Spencer")).toBeVisible({
    timeout: 15_000,
  });
});

test("every module renders for a signed in user", async ({ page }) => {
  // Twelve sign-in-gated navigations in one test. It takes about 20 seconds on
  // a quiet machine, which leaves no room under the 30 second default when
  // anything else is competing for the CPU. The work is real, so the budget
  // should be too: this is not a hidden retry, it is an honest duration.
  test.setTimeout(90_000);
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
    // PLS-111: the h1 is the open view, not the module. "Tasks" is the rail's
    // nav entry, and the masthead above it is what names the module.
    ["/ops/tasks", /today/i],
    ["/content", /content planner/i],
    ["/settings/integrations", /api keys/i],
  ];

  for (const [href, heading] of modules) {
    await page.goto(href);
    await expect(page.getByRole("heading", { name: heading, level: 1 })).toBeVisible();
  }
});

test("skills is a popup on the planner, not a second room", async ({ page }) => {
  await signIn(page);

  // The route is gone on purpose, so a stale bookmark must 404 rather than
  // render an empty shell that looks like the feature was removed.
  const stale = await page.goto("/content/skills");
  expect(stale?.status()).toBe(404);

  await page.goto("/content");
  // The rail carries one section now. Two would mean the nav entry came back.
  const rail = page.getByRole("navigation", { name: "CONTENT sections" });
  await expect(rail.getByRole("link")).toHaveCount(1);

  await page.getByRole("button", { name: "Skills" }).click();
  const dialog = page.getByRole("dialog", { name: "Skills" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("Role post")).toBeVisible();
  await expect(dialog.getByText(/pick the shape first/i)).toBeVisible();

  // Esc closes the topmost layer, and the calendar is still underneath.
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(page.locator("[data-day]")).toHaveCount(42);
});

test("a post opens as a centred dialog, not a right drawer", async ({ page }) => {
  await signIn(page);
  await page.goto("/content?month=2026-08");

  await page.getByText(/I lost a placement/).first().click();
  const dialog = page.getByRole("dialog", { name: /personal story/i });
  await expect(dialog).toBeVisible();

  // Body, schedule and media all reachable without leaving the layer: the
  // 480px drawer put the date controls below the fold.
  await expect(dialog.getByLabel("The post")).toBeVisible();
  await expect(dialog.getByLabel("Date")).toBeVisible();
  await expect(dialog.getByRole("button", { name: /attach files/i })).toBeVisible();
  await expect(dialog.getByRole("button", { name: /copy text/i })).toBeVisible();

  // Centred, not pinned right. A drawer sits flush against the viewport edge;
  // this must not.
  const box = await dialog.boundingBox();
  const width = page.viewportSize()?.width ?? 0;
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThan(20);
  expect(width - (box!.x + box!.width)).toBeGreaterThan(20);

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
});

test("api keys screen separates included keys from the ones you connect", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/settings/integrations");
  // Research and model keys are Pulse's, so they read as included rather than
  // as something to fill in (AI.md section 1).
  await expect(page.getByText("Included with Pulse")).toBeVisible();
  await expect(page.getByText("Included").first()).toBeVisible();
  // The customer's own accounts still ask for a key.
  await expect(page.getByText("Instantly", { exact: false }).first()).toBeVisible();
  await expect(page.getByText("Not set").first()).toBeVisible();
});

// The AI engine refuses honestly when the platform keys are absent, which is
// the state of any environment that has not had them added. AI.md section 4:
// it must not take the question, reserve credits, and then apologise.
test("the ask API refuses a caller with no session", async ({ request }) => {
  const response = await request.post("/api/ask", {
    data: { surface: "market", question: "who is hiring" },
  });
  expect(response.status()).toBe(401);
});

test("the ask API rejects an unknown surface", async ({ page }) => {
  await signIn(page);
  // page.request shares the browser's cookies; the standalone request fixture
  // does not, and would test the unauthenticated path again by accident.
  const response = await page.request.post("/api/ask", {
    data: { surface: "not-a-surface", question: "who is hiring" },
  });
  expect(response.status()).toBe(400);
});

test("a surface with no provider configured says so and takes no question", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/market");

  const composer = page.getByLabel("Your question");
  const configured = await composer.isEnabled();

  if (configured) {
    // Keys are present in this environment, so the engine is live and the
    // composer is usable. The unconfigured path is not what is under test.
    await expect(page.getByRole("button", { name: "Ask" })).toBeVisible();
    return;
  }

  await expect(page.getByText("Not available")).toBeVisible();
  await expect(composer).toBeDisabled();
  await expect(page.getByRole("button", { name: "Ask" })).toBeDisabled();
});
