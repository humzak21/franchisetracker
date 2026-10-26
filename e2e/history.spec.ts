import { expect, expectNoHorizontalOverflow, test } from "./fixtures";

test("history shows totals, the trophy room and decade grids", async ({ page }) => {
  await page.goto("/history");
  await expect(page.getByText("All-time record")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Trophy room" })).toBeVisible();
  for (const title of ["Super Bowls", "Conference titles", "Division titles", "Playoff appearances"]) {
    await expect(page.getByRole("heading", { name: title })).toBeVisible();
  }
  await expect(page.getByRole("heading", { name: "2020s" })).toBeVisible();
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

test("real NFL seasons before the franchise are marked and open their imported stats", async ({ page }) => {
  await page.goto("/history");
  await expect(page.getByTitle("Real NFL season before the franchise").first()).toBeVisible();
  // 2025 is also a conference-title chip in the trophy room; click the decade row.
  const decade = page.locator("section").filter({ has: page.getByRole("heading", { name: "2020s" }) });
  await decade.getByText("2025", { exact: true }).first().click();
  await expect(page).toHaveURL(/\/stats$/);
  await expect(page.getByText(/2025 is real NFL history/)).toBeVisible();
});

test("settings shows the real NFL history import", async ({ page }) => {
  await page.goto("/settings");
  await expect(page.getByRole("heading", { name: "Real NFL history" })).toBeVisible();
  await expect(page.getByText("Up to date")).toBeVisible();
  await expect(page.getByText("2024–2025")).toBeVisible();
  await expectNoHorizontalOverflow(page);
});
