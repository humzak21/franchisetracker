import { test as base, expect, type Page } from "@playwright/test";

export type Theme = "dark" | "light";

/** Phone projects render the tab bar instead of the sidebar. */
export const isPhone = (projectName: string) => projectName.startsWith("phone");

/**
 * `page` that fails the test on any console error or uncaught exception, and starts in the
 * requested theme (the app reads `ft.theme` before first paint).
 */
export const test = base.extend<{ theme: Theme }>({
  theme: ["dark", { option: true }],
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

/** Waits for live Convex data: the seeded franchise name renders in the Home hero. */
export async function gotoHome(page: Page) {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Patriots Dynasty" })).toBeVisible({ timeout: 20_000 });
}
