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

test("the box score shows every table for the franchise's team, then the opponent's", async ({ page }) => {
  await openSchedule(page);
  await page.locator('a[href^="/games/"]').first().click();
  const ours = page.getByRole("region", { name: "New England Patriots" });
  for (const category of ["passing", "rushing", "receiving", "defense"]) {
    await expect(ours.getByRole("table", { name: `NE ${category}` })).toBeVisible();
  }
  // The opponent's section (week 1 is against the Raiders) comes after the franchise's.
  await expect(page.getByRole("region", { name: "Las Vegas Raiders" })).toBeVisible();
  const order = await page
    .locator("section[aria-label]")
    .evaluateAll((els) => els.map((el) => el.getAttribute("aria-label")));
  expect(order.indexOf("New England Patriots")).toBeLessThan(order.indexOf("Las Vegas Raiders"));
  await expect(page.getByRole("radio", { name: "Receiving" })).toHaveCount(0);
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
  await expect(page.getByRole("heading", { name: "Stars of the game" })).toBeVisible();
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

test("the stars picker opens with the game's players and saves", async ({ page }, info) => {
  const gameIndex = ["desktop", "phone", "phone-large"].indexOf(info.project.name);
  await openSchedule(page);
  await page.locator('a[href^="/games/"]').nth(Math.max(gameIndex, 0)).click();
  await page.getByRole("button", { name: "Edit stars" }).click();
  const sheet = page.getByRole("dialog", { name: "Stars of the game" });
  await expect(sheet.getByLabel("Find a player")).toBeVisible();
  await expect(sheet.getByRole("list", { name: "Players" })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  // Saving the list unchanged is a no-op, so parallel projects never disturb each other.
  await sheet.getByRole("button", { name: "Save stars" }).click();
  await expect(sheet).toBeHidden();
});

test("a box score player becomes a star in one click and stops being one in another", async ({ page }) => {
  await openSchedule(page);
  // Week 5 (the fourth link is the week 4 bye): no other test saves stars on it, and the picker
  // test re-saves its own copy of the list.
  await page.locator('a[href^="/games/"]').nth(4).click();
  // Every table is on the page at once; star someone from the receiving table.
  const receiving = page.getByRole("table", { name: "NE receiving" });
  const make = receiving.getByRole("button", { name: /^Make .+ a star$/ }).first();
  const name = (await make.getAttribute("aria-label"))!.replace(/^Make | a star$/g, "");
  await make.click();
  const remove = receiving.getByRole("button", { name: `Remove ${name} from the stars` });
  await expect(remove).toHaveAttribute("aria-pressed", "true");
  // The star editor shows each player's line for the game.
  await page.getByRole("button", { name: "Edit stars" }).click();
  const sheet = page.getByRole("dialog", { name: "Stars of the game" });
  await expect(
    sheet
      .getByRole("list", { name: "Picked stars" })
      .getByText(/\d+ rec, \d+ yds/)
      .first(),
  ).toBeVisible();
  await sheet.getByRole("button", { name: "Cancel" }).click();
  await remove.click();
  await expect(receiving.getByRole("button", { name: `Make ${name} a star` })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
});

/** Each project adds its own week so parallel runs never collide. */
const ADD_WEEK: Record<string, number> = { desktop: 15, phone: 16, "phone-large": 17 };

async function deleteGame(page: Page, row: ReturnType<Page["getByRole"]>) {
  await row.click();
  await page.getByRole("button", { name: "Edit game" }).click();
  await page.getByRole("dialog", { name: "Edit game" }).getByRole("button", { name: "Delete game" }).click();
  await page
    .getByRole("dialog", { name: "Delete this game?" })
    .getByRole("button", { name: "Delete game" })
    .click();
  await expect(page).toHaveURL(/\/schedule$/);
}

test("a game is added by hand, shows on the schedule and is deleted", async ({ page }, info) => {
  const week = ADD_WEEK[info.project.name] ?? 15;
  await openSchedule(page);
  const row = page.getByRole("link", { name: new RegExp(`^Week ${week} `) });
  // A run that stopped halfway may have left its game behind.
  if ((await row.count()) > 0) await deleteGame(page, row.first());

  await page.getByRole("button", { name: "Add game" }).click();
  const sheet = page.getByRole("dialog", { name: "Add game" });
  await sheet.getByLabel("Week", { exact: true }).selectOption(`w${week}`);
  await sheet.getByLabel("Opponent").selectOption({ label: "Kansas City Chiefs" });
  await sheet.getByLabel("Our score").fill("24");
  await sheet.getByLabel("Their score").fill("21");
  await sheet.getByRole("button", { name: "Add game" }).click();
  await expect(sheet).toBeHidden();
  await expect(page.getByRole("link", { name: `Week ${week} vs Chiefs` })).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await deleteGame(page, page.getByRole("link", { name: `Week ${week} vs Chiefs` }));
  await expect(page.getByRole("link", { name: `Week ${week} vs Chiefs` })).toHaveCount(0);
});
