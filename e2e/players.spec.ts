import { expect, expectNoHorizontalOverflow, test } from "./fixtures";

for (const theme of ["dark", "light"] as const) {
  test.describe(`${theme} theme`, () => {
    test.use({ theme });

    test("the players index lists the franchise roster without overflow", async ({ page }) => {
      await page.goto("/players");
      await expect(page.getByRole("heading", { level: 1, name: "Players" })).toBeVisible();
      await expect(page.getByRole("table", { name: "Players" }).getByText("Drake Maye")).toBeVisible({
        timeout: 20_000,
      });
      await expectNoHorizontalOverflow(page);
    });

    test("compare loads two players without overflow", async ({ page }) => {
      await page.goto("/players");
      await page.getByRole("checkbox", { name: "Pick Drake Maye" }).click();
      await page.getByRole("checkbox", { name: "Pick Hunter Henry" }).click();
      await page.getByRole("button", { name: "Compare 2" }).click();
      await expect(page.getByRole("heading", { level: 1, name: "Compare" })).toBeVisible();
      const table = page.getByRole("group", { name: "Comparison" });
      await expect(table.getByRole("link", { name: "Drake Maye" })).toBeVisible();
      await expect(table.getByRole("link", { name: "Hunter Henry" })).toBeVisible();
      await expectNoHorizontalOverflow(page);
    });
  });
}

test("picked players open one signing, release or trade sheet together", async ({ page }) => {
  await page.goto("/players");
  const table = page.getByRole("table", { name: "Players" });
  await expect(table.getByText("Drake Maye")).toBeVisible({ timeout: 20_000 });
  await page.getByRole("checkbox", { name: "Pick Drake Maye" }).click();
  await page.getByRole("checkbox", { name: "Pick Hunter Henry" }).click();
  const bar = page.getByRole("toolbar", { name: "Selection" });
  await expect(bar.getByText("2 players selected")).toBeVisible();

  // Players on the roster now are released; anyone else is signed. Which one depends on the
  // season the shared backend is in, so either batch sheet will do.
  await bar.getByRole("button", { name: /^(Release|Sign) 2$/ }).click();
  const sheet = page.getByRole("dialog", { name: /^(Record a move|Sign a free agent)$/ });
  await expect(sheet.getByRole("button", { name: "Remove Drake Maye" })).toBeVisible();
  await expect(sheet.getByRole("button", { name: "Remove Hunter Henry" })).toBeVisible();
  await expect(sheet.getByRole("button", { name: /^Record 2 (moves|signings)$/ })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();

  // Select all picks every listed player; pressing it again clears them.
  await bar.getByRole("button", { name: /^Select all \d+$/ }).click();
  await expect(bar.getByRole("button", { name: "Deselect all" })).toBeVisible();
  await bar.getByRole("button", { name: "Deselect all" }).click();
  await expect(bar.getByText("Pick players for a batch move")).toBeVisible();
});

test("search reaches imported players and compare adds and removes them", async ({ page }) => {
  await page.goto("/players/compare");
  await expect(page.getByText("Pick players to compare")).toBeVisible();
  await page.getByLabel("Add a player to compare").fill("Maye");
  await page
    .getByRole("listitem")
    .filter({ hasText: "Drake Maye" })
    .getByRole("button", { name: "Add" })
    .click();
  const table = page.getByRole("group", { name: "Comparison" });
  // Imported 2024-25 plus the franchise's 2026.
  await expect(table.getByText("YRS")).toBeVisible();
  await page.getByRole("button", { name: "Remove Drake Maye" }).click();
  await expect(page.getByText("Pick players to compare")).toBeVisible();
});

test("a players row starts a trade with him already in it", async ({ page }) => {
  await page.goto("/players");
  const table = page.getByRole("table", { name: "Players" });
  await expect(table.getByText("Drake Maye")).toBeVisible({ timeout: 20_000 });
  const actions = table.getByRole("button", { name: "Actions for Drake Maye" });
  // On phones the menu sits in the row's expansion card.
  if (!(await actions.isVisible()))
    await table.getByRole("row").filter({ hasText: "Drake Maye" }).getByRole("cell").last().click();
  await actions.click();
  await page.getByRole("button", { name: "Record trade" }).click();
  const sheet = page.getByRole("dialog", { name: "Record a trade" });
  await expect(sheet.getByRole("button", { name: "Remove Drake Maye" })).toBeVisible();
  await expect(page).toHaveURL(/\/players$/);
  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();
});
