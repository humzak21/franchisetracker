import { randomBytes } from "node:crypto";
import { test as base, expect, type Page } from "@playwright/test";
import { ownerSession } from "./ownerSession";

export type Theme = "dark" | "light";

/** The sample franchise `dev/fixtures:seedFixtures` creates for the e2e backend (and CI). */
export const SAMPLE_FRANCHISE = "Sample Franchise";
export const SAMPLE_YEAR = 2026;

const ONE_PIXEL = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64",
);

/**
 * A 1x1 PNG: the local e2e backend has no OpenRouter key, so the built-in sample answer reads it.
 * The bytes after the image differ every call, or the inbox would hold it as a repeat.
 */
export const png = () => Buffer.concat([ONE_PIXEL, randomBytes(8)]);

/** Phone projects render the tab bar instead of the sidebar. */
export const isPhone = (projectName: string) => projectName.startsWith("phone");

/**
 * Calls every name a review could not settle new, so a game can commit. Other tests may already
 * have added the same players, so there may be nothing to decide.
 */
export async function createUndecidedPlayers(page: Page) {
  const create = page.getByRole("button", { name: /^Create .+ as new/ });
  while ((await create.count()) > 0) await create.first().click();
}

/** Signs in through the local-only test provider (the e2e backend runs with AUTH_TEST_MODE). */
export async function signInAsTestOwner(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Sign in as test owner (local)" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Home" })).toBeVisible({ timeout: 20_000 });
}

/**
 * `page` that fails the test on any console error or uncaught exception, starts in the
 * requested theme (the app reads `ft.theme` before first paint), and is signed in unless
 * the test opts out with `test.use({ signedIn: false })`. Tests start on a blank page, so
 * each one navigates where it needs to.
 */
export const test = base.extend<{ theme: Theme; signedIn: boolean }>({
  theme: ["dark", { option: true }],
  signedIn: [true, { option: true }],
  storageState: async ({ signedIn, baseURL }, use) => {
    if (!baseURL) throw new Error("playwright.config.ts must set baseURL");
    await use(signedIn ? await ownerSession(baseURL) : undefined);
  },
  page: async ({ page, theme }, use) => {
    const errors: string[] = [];
    page.on("console", (msg) => msg.type() === "error" && errors.push(msg.text()));
    page.on("pageerror", (err) => errors.push(err.message));
    await page.addInitScript((t) => localStorage.setItem("ft.theme", JSON.stringify(t)), theme);
    await use(page);
    expect(errors, "console errors").toEqual([]);
  },
});

export { expect };

/** Fails when the page scrolls sideways: the most common phone layout bug. */
export async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, "horizontal overflow in px").toBeLessThanOrEqual(0);
}

/** Waits for live Convex data: the sample franchise name renders in the Home hero. */
export async function gotoHome(page: Page) {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: SAMPLE_FRANCHISE })).toBeVisible({ timeout: 20_000 });
}
