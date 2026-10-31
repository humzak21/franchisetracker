import { expect, expectNoHorizontalOverflow, SAMPLE_FRANCHISE, test } from "./fixtures";

// Every project shares one backend, so this never deletes: it walks both confirmations and
// cancels. Deleting (the active franchise included) is covered by convex-test in convex/franchise.

for (const theme of ["dark", "light"] as const) {
  test.describe(`${theme} theme`, () => {
    test.use({ theme });

    test("player identity lists duplicates and tidying without overflow", async ({ page }) => {
      await page.goto("/settings");
      await expect(page.getByRole("heading", { name: "Player identity" })).toBeVisible({ timeout: 20_000 });
      await expectNoHorizontalOverflow(page);
    });

    test("deleting the active franchise asks twice before anything goes", async ({ page }) => {
      await page.goto("/settings");
      await page.getByRole("button", { name: `Delete ${SAMPLE_FRANCHISE}` }).click({ timeout: 20_000 });

      const sure = page.getByRole("dialog", { name: `Delete ${SAMPLE_FRANCHISE}?` });
      await expect(sure.getByText(/Are you sure\?/)).toBeVisible();
      await expect(sure.getByText(/the one you used before it takes over/)).toBeVisible();
      await expectNoHorizontalOverflow(page);
      await sure.getByRole("button", { name: "Yes, delete it" }).click();

      const typed = page.getByRole("dialog", { name: `Type ${SAMPLE_FRANCHISE} to confirm` });
      const destroy = typed.getByRole("button", { name: "Delete franchise" });
      await expect(destroy).toBeDisabled();
      await typed.getByLabel("Franchise name").fill("Sample");
      await expect(destroy).toBeDisabled();
      await typed.getByRole("button", { name: "Cancel" }).click();
      await expect(typed).toBeHidden();

      await expect(page.getByText("Active", { exact: true })).toBeVisible();
    });
  });
}

test("game highlights sit under the season highlights with their own defaults", async ({ page }) => {
  await page.goto("/settings");
  const season = page.getByRole("heading", { name: "Highlights", exact: true });
  const game = page.getByRole("heading", { name: "Game highlights" });
  await expect(game).toBeVisible();
  const [seasonBox, gameBox] = await Promise.all([season.boundingBox(), game.boundingBox()]);
  expect(gameBox!.y).toBeGreaterThan(seasonBox!.y);
  await expect(page.getByLabel("Single-game Passing yards tier 1")).toHaveValue("300");
  await expect(page.getByLabel("Single-game Passing yards tier 2")).toHaveValue("500");
});

test("maintenance checks a job before it runs, without overflow", async ({ page }) => {
  await page.goto("/settings");
  await expect(page.getByRole("heading", { name: "Maintenance" })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("Rebuild stats", { exact: true })).toBeVisible();
  const row = page.getByRole("listitem").filter({ hasText: "Clear typed star lines" });
  await row.getByRole("button", { name: "Check" }).click();
  await expect(row.getByText(/\d+ captions?/)).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test("the extraction budget saves and shows against the month", async ({ page }) => {
  await page.goto("/settings");
  const budget = page.getByLabel("Monthly budget, dollars");
  const save = page.locator("form").filter({ has: budget }).getByRole("button", { name: "Save" });
  await budget.fill("250");
  await save.click();
  await expect(page.getByText("A banner shows from 80 percent", { exact: false })).toBeVisible();
  await budget.fill("");
  await save.click();
  await expect(page.getByText("so far this month")).toBeVisible();
});
