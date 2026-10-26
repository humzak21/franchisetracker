import { defineConfig, devices } from "@playwright/test";

const CI = !!process.env.CI;
const E2E_PORT = 5174;

/**
 * Smoke tests against a fully local stack: an anonymous local Convex backend (pushed and
 * seeded on start) and Vite in `e2e` mode, which points the client at that backend.
 * Phones run in WebKit (the iPhone engine) at the two sizes FEATURES.md 9 requires.
 */
export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  workers: CI ? 2 : undefined,
  reporter: CI ? [["github"], ["html", { open: "never" }]] : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: `http://localhost:${E2E_PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    {
      name: "phone",
      use: { ...devices["iPhone 13"], viewport: { width: 390, height: 844 } },
    },
    {
      name: "phone-large",
      use: { ...devices["iPhone 14 Pro Max"], viewport: { width: 430, height: 932 } },
    },
  ],
  webServer: [
    {
      // Pushes functions to the local backend, turns on test sign-in, seeds the league and (only
      // when 2025 is empty, as in CI) a small sample season, then keeps watching.
      command:
        "npm run local:setup && npx convex run franchise/seed:seedInitial && CONVEX_DEPLOYMENT=anonymous:anonymous-agent npx convex dev --run dev/fixtures:seedFixtures --tail-logs disable",
      port: 3210,
      wait: { stdout: /Finished running function/ },
      reuseExistingServer: !CI,
      timeout: 180_000,
      stdout: "pipe",
    },
    {
      command: `npx vite --mode e2e --port ${E2E_PORT} --strictPort`,
      url: `http://localhost:${E2E_PORT}`,
      reuseExistingServer: !CI,
      timeout: 60_000,
    },
  ],
});
