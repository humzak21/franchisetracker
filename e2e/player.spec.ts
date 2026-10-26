import type { Page } from "@playwright/test";
import { expect, expectNoHorizontalOverflow, test } from "./fixtures";

async function openDiggs(page: Page) {
  await page.goto("/roster");
  await page
    .getByRole("link", { name: /Stefon Diggs/ })
    .first()
    .click({ timeout: 20_000 });
  await expect(page.getByRole("heading", { level: 1, name: "Stefon Diggs" })).toBeVisible();
}

test("player page shows the hero, career stats with totals and roster history", async ({ page }) => {
  await openDiggs(page);
  await expect(page.getByRole("heading", { level: 2, name: "Stefon Diggs" })).toBeVisible();
  const career = page.getByRole("table", { name: "Career stats" });
  await expect(career).toBeVisible();
  await expect(career.locator("tfoot").getByText("Career")).toBeVisible();
  await expect(page.getByRole("table", { name: "Roster history" })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test("player notes save on blur", async ({ page }) => {
  await openDiggs(page);
  const notes = page.getByLabel("Scouting notes");
  // The local backend may hold real imported notes: restore them at the end.
  const original = await notes.inputValue();
  const text = `Route runner, checked ${Date.now()}`;
  await notes.fill(text);
  await notes.blur();
  await expect(page.getByText("Saved")).toBeVisible();
  await page.reload();
  const reloaded = page.getByLabel("Scouting notes");
  await expect(reloaded).toHaveValue(text);

  await reloaded.fill(original);
  await reloaded.blur();
  await expect(page.getByText("Saved")).toBeVisible();
});

test("back link returns to the roster", async ({ page }) => {
  await openDiggs(page);
  await page.getByRole("link", { name: "Back to Roster" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Roster" })).toBeVisible();
});
