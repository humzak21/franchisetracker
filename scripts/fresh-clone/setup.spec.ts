import { expect, test } from "@playwright/test";

/** A new deployment's first minutes: sign in, set up the first franchise, land on Home. */
test("a fresh clone signs in, sets up its first franchise and lands on Home", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Sign in as test owner (local)" }).click();
  await expect(page.getByRole("heading", { name: "Pick your team" })).toBeVisible({ timeout: 30_000 });
  await page.getByPlaceholder("e.g. Foxborough Dynasty").fill("Fresh Clone Franchise");
  await page.getByRole("radio", { name: /Detroit Lions/ }).click();
  await page.getByRole("button", { name: "Create franchise" }).click();
  await expect(page.getByRole("heading", { name: "Fresh Clone Franchise" })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("heading", { level: 1, name: "Home" })).toBeVisible();
  await page.goto("/settings");
  await expect(page.getByRole("heading", { name: "Real NFL history" })).toBeVisible();
});
