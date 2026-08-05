import { chromium } from "@playwright/test";
const B = "https://pulse-two-sepia.vercel.app";
const b = await chromium.launch();
const p = await (await b.newContext()).newPage();
await p.goto(`${B}/signin`);
await p.getByLabel("Email").fill("daniyal@nortech.io");
await p.getByLabel("Password").fill("pulse-demo-2026");
await p.getByRole("button", { name: /sign in/i }).click();
await p.waitForURL(/pipeline|candidates/, { timeout: 40000 });

// Time the server's own work: how long the document takes, warm.
for (const route of ["/content", "/ops/tasks", "/candidates", "/pipeline"]) {
  const t = [];
  for (let i = 0; i < 4; i++) {
    const start = Date.now();
    const r = await p.goto(B + route, { waitUntil: "domcontentloaded" });
    t.push(Date.now() - start);
    if (i === 0) console.log(route, "cache:", r?.headers()["x-vercel-cache"] ?? "none", "age:", r?.headers()["age"] ?? "-");
  }
  t.sort((a,z)=>a-z);
  console.log(route.padEnd(14), "median", t[2] + "ms", "  all:", t.join(", "));
}
await b.close();
