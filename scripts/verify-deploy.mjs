// Signs in against a deployed Pulse and confirms real data renders.
// Usage: node scripts/verify-deploy.mjs https://your-deployment.vercel.app
import { chromium } from "@playwright/test";

const base = process.argv[2];
if (!base) {
  console.error("usage: node scripts/verify-deploy.mjs <url>");
  process.exit(1);
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1500, height: 900 } });
const problems = [];

try {
  await page.goto(`${base}/candidates`, { waitUntil: "load" });
  if (!page.url().includes("/signin")) {
    problems.push("an unauthenticated request reached /candidates");
  }

  await page.goto(`${base}/signin`, { waitUntil: "load" });
  await page.getByLabel("Email").fill("daniyal@nortech.io");
  await page.getByLabel("Password").fill("pulse-demo-2026");
  await page.getByRole("button", { name: /sign in/i }).click();

  await page.waitForURL(/\/(pipeline|candidates)/, { timeout: 30_000 });
  console.log(`signed in, landed on ${page.url()}`);

  // Seeded rows the database returned, not a fixture in this repo.
  await page.getByText("Clementine Spencer").first().waitFor({ timeout: 20_000 });
  console.log("real pipeline data rendered");

  for (const [path, heading] of [
    ["/market", /bd engine/i],
    ["/ops", /morning brief/i],
    ["/sequences", /sequences/i],
    ["/content", /content planner/i],
    ["/settings/integrations", /api keys/i],
  ]) {
    await page.goto(`${base}${path}`, { waitUntil: "load" });
    const ok = await page
      .getByRole("heading", { name: heading, level: 1 })
      .isVisible()
      .catch(() => false);
    if (!ok) problems.push(`${path} did not render its heading`);
  }

  await page.screenshot({ path: ".design-shots/deployed.png" });
} catch (err) {
  problems.push(err.message.split("\n")[0]);
} finally {
  await browser.close();
}

if (problems.length) {
  console.error("FAILED:");
  problems.forEach((p) => console.error(`  - ${p}`));
  process.exit(1);
}
console.log("PASS: deployment signs in and every checked module renders");
