// Batch full-page screenshots of a reference site, cookie banners dismissed.
// Usage: node scripts/shot-many.mjs <outDir> <url> [url...]
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const [outDir, ...urls] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  deviceScaleFactor: 1,
});

// Pre-consent so the Cookiebot overlay never covers the hero.
await context.addCookies([
  {
    name: "CookieConsent",
    value:
      "{stamp:%27x%27%2Cnecessary:true%2Cpreferences:true%2Cstatistics:true%2Cmarketing:true%2Cver:1}",
    domain: new URL(urls[0]).hostname,
    path: "/",
  },
]);

for (const url of urls) {
  const name =
    new URL(url).pathname.replace(/^\/|\/$/g, "").replace(/\//g, "_") || "home";
  const page = await context.newPage();
  try {
    await page.goto(url, { waitUntil: "networkidle", timeout: 60_000 });
    // Belt and braces: click any visible consent button that remains.
    for (const label of [/allow all/i, /accept/i, /got it/i]) {
      const btn = page.getByRole("button", { name: label });
      if (await btn.first().isVisible().catch(() => false)) {
        await btn.first().click().catch(() => {});
        break;
      }
    }
    await page.evaluate(() =>
      document
        .querySelectorAll("#CybotCookiebotDialog, #CybotCookiebotDialogBodyUnderlay")
        .forEach((n) => n.remove()),
    );
    // Trigger lazy sections, then return to the top.
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 900) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 120));
      }
      window.scrollTo(0, 0);
    });
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${outDir}/${name}.png`, fullPage: true });
    console.log(`ok   ${name}`);
  } catch (err) {
    console.log(`FAIL ${name}: ${err.message.split("\n")[0]}`);
  } finally {
    await page.close();
  }
}

await browser.close();
