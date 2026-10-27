import type { Page } from "@playwright/test";
import { SAMPLE_YEAR, expect, expectNoHorizontalOverflow, test } from "./fixtures";

/** The sample franchise's current season always has a roster: offense, defense and a kicker. */
async function openRoster(page: Page) {
  await page.goto("/roster");
  await expect(page.getByRole("heading", { level: 1, name: "Roster" })).toBeVisible();
  await expect(page.getByText(`${SAMPLE_YEAR} season`)).toBeVisible();
  const offense = page.getByRole("table", { name: `${SAMPLE_YEAR} offense` });
  await expect(offense.getByRole("link").first()).toBeVisible({ timeout: 20_000 });
  return offense;
}

for (const theme of ["dark", "light"] as const) {
  test.describe(`${theme} theme`, () => {
    test.use({ theme });

    test("roster renders three tables and the averages without overflow", async ({ page }) => {
      await openRoster(page);
      for (const side of ["offense", "defense", "special teams"])
        await expect(page.getByRole("table", { name: `${SAMPLE_YEAR} ${side}` })).toBeVisible();
      await expect(page.getByText(/^Team · \d+$/)).toBeVisible();
      await expect(page.getByText("avg OVR").first()).toBeVisible();
      await expectNoHorizontalOverflow(page);
    });
  });
}

test("each side's table holds only its positions", async ({ page }) => {
  const offense = await openRoster(page);
  await expect(offense.getByText("Stefon Diggs")).toBeVisible();
  await expect(offense.getByText("Robert Spillane")).toHaveCount(0);
  const defense = page.getByRole("table", { name: `${SAMPLE_YEAR} defense` });
  await expect(defense.getByText("Robert Spillane")).toBeVisible();
  await expect(defense.getByText("Stefon Diggs")).toHaveCount(0);
  const special = page.getByRole("table", { name: `${SAMPLE_YEAR} special teams` });
  await expect(special.getByText("Andres Borregales")).toBeVisible();
  await expect(special.getByText("Stefon Diggs")).toHaveCount(0);
});

test("Edit turns a table's cells into inputs and Done turns them back", async ({ page }) => {
  await openRoster(page);
  const section = page.locator("section#offense");
  await section.getByRole("button", { name: "Edit" }).click();
  await expect(section.getByRole("textbox", { name: "Player" }).first()).toBeVisible();
  await section.getByRole("button", { name: "Done" }).click();
  await expect(section.getByRole("textbox", { name: "Player" })).toHaveCount(0);
  await expect(section.getByRole("link", { name: /Stefon Diggs/ })).toBeVisible();
});

test("Add player and Move open their sheets", async ({ page }) => {
  await openRoster(page);
  await page.getByRole("button", { name: "Add player" }).click();
  await expect(page.getByRole("dialog", { name: "Add player" })).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("dialog", { name: "Add player" })).toHaveCount(0);

  const offense = page.getByRole("table", { name: `${SAMPLE_YEAR} offense` });
  const move = offense.getByRole("button", { name: "Move Stefon Diggs" });
  // On phones the action sits in the row's expansion card.
  if (!(await move.isVisible()))
    await offense.getByRole("row").filter({ hasText: "Stefon Diggs" }).getByRole("cell").last().click();
  await move.click();
  await expect(page.getByRole("dialog", { name: "Move Stefon Diggs" })).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).click();
});

test("a player row links to the player page", async ({ page }) => {
  const offense = await openRoster(page);
  await offense.getByRole("link", { name: /Stefon Diggs/ }).click();
  await expect(page).toHaveURL(/\/players\/[^/]+$/);
  await expect(page.getByRole("heading", { level: 1, name: "Stefon Diggs" })).toBeVisible();
});
