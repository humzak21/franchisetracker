import { defineConfig, devices } from "@playwright/test";

const CI = !!process.env.CI;
const E2E_PORT = 5174;

/**
 * Smoke tests against a fully local stack: an anonymous local Convex backend (pushed and
 * seeded on start) and the app built in `e2e` mode, which points the client at that backend.
 * Desktop Chrome runs everything; a phone in WebKit (the iPhone engine) runs the layout checks.
 */
export default defineConfig({
  testDir: "e2e",
  globalSetup: "./e2e/globalSetup.ts",
  fullyParallel: true,
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  // Each worker is a browser. Memory runs out on this Mac long before its CPUs do, and then the
  // backend stalls too, so more workers made runs slower as well as flakier.
  workers: CI ? 2 : 3,
  // Generous everywhere, not only on CI's 2 vCPUs: a Mac short of memory stalls for seconds at a
  // time without its CPUs being busy, and these numbers only slow down a wait that was failing.
  timeout: 60_000,
  expect: { timeout: 10_000 },
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
    // The app is mostly used on the Mac: phones get only the layout smoke tests (every screen
    // loads without horizontal overflow), in WebKit at the iPhone size FEATURES.md 9 names.
    {
      name: "phone",
      grep: /without overflow/,
      // WebKit is by far the heaviest browser here, and running it wide is what tips a busy Mac
      // into swapping: load went from 100 to 500 when this project started.
      workers: 2,
      use: { ...devices["iPhone 13"], viewport: { width: 390, height: 844 } },
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
