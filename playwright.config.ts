import { defineConfig, devices } from "@playwright/test";

const CI = !!process.env.CI;
const E2E_PORT = 5174;

/**
 * Smoke tests against a fully local stack: an anonymous local Convex backend (pushed and
 * seeded on start) and the app built in `e2e` mode, which points the client at that backend.
 * Phones run in WebKit (the iPhone engine) at the two sizes FEATURES.md 9 requires.
 */
export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  workers: CI ? 2 : undefined,
  // CI runners have 2 vCPUs for the backend, the server and two browsers: a screen's first data
  // can take longer than the 5 s default there. Only failing waits get slower.
  expect: { timeout: CI ? 10_000 : 5_000 },
  reporter: CI ? [["github"], ["html", { open: "never" }]] : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: `http://localhost:${E2E_PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    // The PWA service worker only caches the build; it has nothing to do with what these test.
    serviceWorkers: "block",
    // The app turns its motion off (150-250 ms eases) under reduced motion, so a click no longer
    // waits for a sheet or section to stop moving: on CI WebKit that wait was a second a click.
    reducedMotion: "reduce",
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
      // Local Convex backend with test sign-in, the teams and the sample franchise. Port 3299 opens
      // only once all of that is done (see scripts/e2e-backend.mjs).
      command: "node scripts/e2e-backend.mjs",
      port: 3299,
      reuseExistingServer: !CI,
      timeout: 240_000,
      stdout: "pipe",
    },
    {
      // A bundled build instead of the dev server: every test opens a fresh browser context, and
      // the dev server would make each one fetch hundreds of modules (and re-optimize deps
      // mid-test). NODE_ENV=development keeps React's dev warnings, which fail tests as console
      // errors. A few seconds to build; rerun the tests to pick up app changes.
      command: `npx vite build --mode e2e --outDir dist/e2e && npx vite preview --outDir dist/e2e --port ${E2E_PORT} --strictPort`,
      env: { NODE_ENV: "development" },
      url: `http://localhost:${E2E_PORT}`,
      reuseExistingServer: !CI,
      timeout: 120_000,
    },
  ],
});
