// Screenshot just the viewport (no full-page stitch), for reading fine detail.
// Usage: node scripts/shot-viewport.mjs <url> <out.png> [width] [height] [scrollY]
import { chromium } from "@playwright/test";

const [url, out, width = "1440", height = "900", scrollY = "0"] =
  process.argv.slice(2);

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: Number(width), height: Number(height) },
  deviceScaleFactor: 2,
});

await page.goto(url, { waitUntil: "load" });
 await page.waitForTimeout(700);
if (Number(scrollY) > 0) {
  await page.evaluate((y) => window.scrollTo(0, y), Number(scrollY));
  await page.waitForTimeout(900);
}
await page.screenshot({ path: out });
await browser.close();
console.log(`wrote ${out}`);
