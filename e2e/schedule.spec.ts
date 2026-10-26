import type { Page } from "@playwright/test";
import { SAMPLE_YEAR, expect, expectNoHorizontalOverflow, isPhone, test } from "./fixtures";

/** The sample franchise's current season is the one with games. */
async function openSchedule(page: Page) {
  await page.goto("/schedule");
  await expect(page.getByText(`${SAMPLE_YEAR} season`)).toBeVisible();
}

test("schedule lists weeks with results, a bye and a season summary", async ({ page }) => {
  await openSchedule(page);
  await expect(page.getByRole("heading", { name: "Regular season" })).toBeVisible();
  await expect(page.getByText("Bye week").first()).toBeVisible();
  await expect(page.locator('a[href^="/games/"]').first()).toBeVisible();
  for (const label of ["Record", "Points", "Streak"])
    await expect(page.getByText(label, { exact: true })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test("game detail shows the score bug, stars and saves notes", async ({ page }, info) => {
  // Each project edits a different game so parallel runs never overwrite each other's note.
  const gameIndex = ["desktop", "phone", "phone-large"].indexOf(info.project.name);
  await openSchedule(page);
  await page.locator('a[href^="/games/"]').nth(Math.max(gameIndex, 0)).click();
  await expect(page).toHaveURL(/\/games\//);
  // The score bug renders a phone and a wide layout; only one is visible.
  await expect(
    page
      .getByText(/^Final/)
      .filter({ visible: true })
      .first(),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Three stars" })).toBeVisible();
  await expectNoHorizontalOverflow(page);

  // On phones the notes live in the second pane of the split view.
  const openNotes = async () => {
    if (isPhone(info.project.name)) await page.getByRole("radio", { name: "Notes" }).click();
  };
  // The e2e backend is the local dev deployment, which may hold your own data: restore the note.
  await openNotes();
  const notes = page.getByLabel("Game notes");
  const original = await notes.inputValue();
  const text = `Smoke test note ${Date.now()}`;
  await notes.fill(text);
  await notes.blur();
  await expect(page.getByText("Saved")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "Next game" })).toBeVisible();
  await openNotes();
  await expect(page.getByLabel("Game notes")).toHaveValue(text);
  await page.getByLabel("Game notes").fill(original);
  await page.getByLabel("Game notes").blur();
  await expect(page.getByText("Saved")).toBeVisible();
});

test("next game navigation moves through the season", async ({ page }) => {
  await openSchedule(page);
  await page.locator('a[href^="/games/"]').first().click();
  const first = page.url();
  await page.getByRole("button", { name: "Next game" }).click();
  await expect(page).not.toHaveURL(first);
  await page.getByRole("button", { name: "Previous game" }).click();
  await expect(page).toHaveURL(first);
});
