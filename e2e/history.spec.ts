import { expect, expectNoHorizontalOverflow, test } from "./fixtures";

test("history shows totals, the trophy room and decade grids", async ({ page }) => {
  await page.goto("/history");
  await expect(page.getByText("All-time record")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Trophy room" })).toBeVisible();
  for (const title of ["Super Bowls", "Conference titles", "Division titles", "Playoff appearances"]) {
    await expect(page.getByRole("heading", { name: title })).toBeVisible();
  }
  await expect(page.getByRole("heading", { name: "2020s" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "2030s" })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test("real-history titles can be added and removed", async ({ page }) => {
  await page.goto("/history");
  await page.getByRole("button", { name: "Real history" }).click();
  const sheet = page.getByRole("dialog", { name: "Real history" });
  await sheet.getByLabel("Year").fill("1901");
  await sheet.getByLabel("Note").fill("Smoke test");
  await sheet.getByRole("button", { name: "Add" }).click();
  const row = sheet.getByRole("listitem").filter({ hasText: "1901" });
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: "Remove 1901" }).click();
  await expect(row).toHaveCount(0);
});

test("a season in the decade grid opens that season's schedule", async ({ page }) => {
  await page.goto("/history");
  await page.getByText("2027", { exact: true }).first().click();
  await expect(page).toHaveURL(/\/schedule$/);
  await expect(page.getByText("2027 season")).toBeVisible();
});
