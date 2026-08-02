// Screenshot a route for the design-review skill.
// Usage: node scripts/shot.mjs <url> <out.png> [width] [height]
import { chromium } from "@playwright/test";

const [url, out, width = "1440", height = "1000"] = process.argv.slice(2);

if (!url || !out) {
  console.error("usage: node scripts/shot.mjs <url> <out.png> [width] [height]");
  process.exit(1);
}

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: Number(width), height: Number(height) },
  deviceScaleFactor: 2,
});

const startedAt = Date.now();
await page.goto(url, { waitUntil: "networkidle" });
const loadMs = Date.now() - startedAt;

await page.screenshot({ path: out, fullPage: true });
await browser.close();

console.log(`loaded ${url} in ${loadMs}ms`);
console.log(`wrote ${out}`);
