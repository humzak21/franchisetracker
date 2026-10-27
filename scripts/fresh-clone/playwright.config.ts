import { defineConfig, devices } from "@playwright/test";

/** Run by scripts/fresh-clone/check.mjs against a clone in FRESH_CLONE_DIR; not part of `test:e2e`. */
const cwd = process.env.FRESH_CLONE_DIR;
if (!cwd) throw new Error("Run this through npm run check:fresh-clone");

export default defineConfig({
  testDir: ".",
  testMatch: "setup.spec.ts",
  timeout: 120_000,
  reporter: [["list"]],
  use: { baseURL: "http://localhost:5177", ...devices["Desktop Chrome"] },
  webServer: [
    { command: "npx convex dev --tail-logs disable", port: 3210, timeout: 180_000, cwd },
    { command: "npx vite --port 5177 --strictPort", url: "http://localhost:5177", timeout: 120_000, cwd },
  ],
});
