import { defineConfig, devices } from "@playwright/test";

// Configurable so a stray server on the default port cannot silently hijack a
// run. Playwright never reuses an existing server: doing so once made the suite
// pass against a stale build, which is worse than having no suite.
const PORT = Number(process.env.PULSE_TEST_PORT ?? 4399);

// Tests run against the production build, never the dev server. Dev-only layout
// shift and slow fonts produce false results, especially for the speed budget.
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "on-first-retry",
  },
  // The speed project runs only after every functional test has finished, so it
  // measures a quiet server. Sharing a server with 19 parallel tests made the
  // samples fall monotonically from 1022ms to 97ms, which measured contention
  // rather than the application.
  projects: [
    {
      name: "functional",
      testIgnore: /speed\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "speed",
      testMatch: /speed\.spec\.ts/,
      dependencies: ["functional"],
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: `npm run build && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
