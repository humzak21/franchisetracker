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
      await page.getByRole("checkbox", { name: "Compare Drake Maye" }).click();
      await page.getByRole("checkbox", { name: "Compare Hunter Henry" }).click();
      await page.getByRole("button", { name: "Compare 2" }).click();
      await expect(page.getByRole("heading", { level: 1, name: "Compare" })).toBeVisible();
      const table = page.getByRole("group", { name: "Comparison" });
      await expect(table.getByRole("link", { name: "Drake Maye" })).toBeVisible();
      await expect(table.getByRole("link", { name: "Hunter Henry" })).toBeVisible();
      await expectNoHorizontalOverflow(page);
    });
  });
}

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
