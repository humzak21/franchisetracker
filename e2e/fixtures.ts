import { test as base, expect, type Page } from "@playwright/test";

export type Theme = "dark" | "light";

/** Phone projects render the tab bar instead of the sidebar. */
export const isPhone = (projectName: string) => projectName.startsWith("phone");

/** Signs in through the local-only test provider (the e2e backend runs with AUTH_TEST_MODE). */
export async function signInAsTestOwner(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Sign in as test owner (local)" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Home" })).toBeVisible({ timeout: 20_000 });
}

/**
 * `page` that fails the test on any console error or uncaught exception, starts in the
 * requested theme (the app reads `ft.theme` before first paint), and is signed in unless
 * the test opts out with `test.use({ signedIn: false })`.
 */
export const test = base.extend<{ theme: Theme; signedIn: boolean }>({
  theme: ["dark", { option: true }],
  signedIn: [true, { option: true }],
  page: async ({ page, theme, signedIn }, use) => {
    const errors: string[] = [];
    page.on("console", (msg) => msg.type() === "error" && errors.push(msg.text()));
    page.on("pageerror", (err) => errors.push(err.message));
    await page.addInitScript((t) => localStorage.setItem("ft.theme", JSON.stringify(t)), theme);
    if (signedIn) await signInAsTestOwner(page);
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

/** Waits for live Convex data: the seeded franchise name renders in the Home hero. */
export async function gotoHome(page: Page) {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Patriots Dynasty" })).toBeVisible({ timeout: 20_000 });
}
