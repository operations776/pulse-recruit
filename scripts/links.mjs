// List internal links on a page. Used to discover a reference site's page set.
import { chromium } from "@playwright/test";

const [url] = process.argv.slice(2);
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(url, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2500);

const origin = new URL(url).origin;
const links = await page.evaluate(() =>
  Array.from(document.querySelectorAll("a[href]")).map((a) => a.href),
);
await browser.close();

const internal = [
  ...new Set(
    links
      .filter((h) => h.startsWith(origin))
      .map((h) => h.split("#")[0].split("?")[0].replace(/\/$/, "")),
  ),
].sort();

console.log(internal.join("\n"));
