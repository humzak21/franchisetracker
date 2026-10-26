import type { Page } from "@playwright/test";
import { SAMPLE_YEAR, expect, expectNoHorizontalOverflow, isPhone, test } from "./fixtures";

/** The sample franchise's current season always has a roster. */
async function openRoster(page: Page) {
  await page.goto("/roster");
  await expect(page.getByRole("heading", { level: 1, name: "Roster" })).toBeVisible();
  await expect(page.getByText(`${SAMPLE_YEAR} season`)).toBeVisible();
  const table = page.getByRole("table", { name: `${SAMPLE_YEAR} roster` });
  await expect(table.getByRole("link").first()).toBeVisible({ timeout: 20_000 });
  return table;
}

for (const theme of ["dark", "light"] as const) {
  test.describe(`${theme} theme`, () => {
    test.use({ theme });

    test("roster renders players without overflow", async ({ page }) => {
      const table = await openRoster(page);
      expect(await table.getByRole("link").count()).toBeGreaterThan(0);
      await expectNoHorizontalOverflow(page);
    });
  });
}

test("filtering to defense shows only defensive positions", async ({ page }, info) => {
  const table = await openRoster(page);
  if (isPhone(info.project.name)) {
    await page.getByRole("button", { name: /^Side:/ }).click();
    await page
      .getByRole("dialog", { name: "Side" })
      .getByRole("radio", { name: /^Defense/ })
      .click();
  } else {
    await page.getByRole("radio", { name: /^Defense/ }).click();
  }
  const badges = table.locator("tbody tr td:nth-child(2)");
  await expect(table.getByText("Stefon Diggs")).toHaveCount(0);
  const positions = (await badges.allInnerTexts()).map((t) => t.trim()).filter(Boolean);
  for (const pos of positions)
    expect(["LEDG", "REDG", "DT", "SAM", "MLB", "WILL", "CB", "FS", "SS"]).toContain(pos);
});

test("a player row links to the player page", async ({ page }) => {
  const table = await openRoster(page);
  await table.getByRole("link", { name: /Stefon Diggs/ }).click();
  await expect(page).toHaveURL(/\/players\/[^/]+$/);
  await expect(page.getByRole("heading", { level: 1, name: "Stefon Diggs" })).toBeVisible();
});
