// Open a dialog and screenshot it, to check the scrim blur behind a popup.
import { chromium } from "@playwright/test";

const [url, out] = process.argv.slice(2);
const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1500, height: 900 },
  deviceScaleFactor: 2,
});
await page.goto(url, { waitUntil: "load" });
await page.waitForTimeout(600);
await page.getByRole("button", { name: "Add candidate" }).first().click();
await page.waitForTimeout(600);
await page.screenshot({ path: out });
await browser.close();
console.log(`wrote ${out}`);
