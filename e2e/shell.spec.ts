import { NAV_ITEMS } from "../src/app/nav";
import { expect, expectNoHorizontalOverflow, gotoHome, isPhone, test } from "./fixtures";

for (const theme of ["dark", "light"] as const) {
  test.describe(`${theme} theme`, () => {
    test.use({ theme });

    test("home renders live franchise data", async ({ page }) => {
      await gotoHome(page);
      await expect(page.locator("html")).toHaveClass(theme === "dark" ? /dark/ : /^(?!.*dark)/);
      await expect(page.getByRole("button", { name: /^20(2[5-9]|3[0-4])/ })).toHaveCount(10);
      await expectNoHorizontalOverflow(page);
    });

    test("every screen loads without overflow", async ({ page }) => {
      for (const item of NAV_ITEMS) {
        await page.goto(item.to);
        await expect(page.getByRole("heading", { level: 1, name: item.label })).toBeVisible();
        await expectNoHorizontalOverflow(page);
      }
    });
  });
}

test("navigation chrome matches the device", async ({ page }, info) => {
  await gotoHome(page);
  const sidebar = page.getByRole("navigation", { name: "Main" }).filter({ hasText: "Transactions" }).first();
  const capture = page.getByRole("link", { name: "Capture screenshots" });
  if (isPhone(info.project.name)) {
    await expect(page.getByRole("button", { name: "More" })).toBeVisible();
    await expect(capture).toBeVisible();
    await expect(sidebar).toBeHidden();
  } else {
    await expect(sidebar).toBeVisible();
    await expect(page.getByRole("button", { name: "More" })).toBeHidden();
    await expect(capture).toBeHidden();
  }
});

test("phone More sheet reaches every secondary screen", async ({ page }, info) => {
  test.skip(!isPhone(info.project.name), "phone only");
  await gotoHome(page);
  await page.getByRole("button", { name: "More" }).click();
  const sheet = page.getByRole("dialog", { name: "More" });
  await expect(sheet).toBeVisible();
  await sheet.getByRole("link", { name: "League" }).click();
  await expect(page).toHaveURL(/\/league$/);
  await expect(page.getByRole("heading", { level: 1, name: "League" })).toBeVisible();
});

test("season switcher is remembered per screen", async ({ page }) => {
  await page.goto("/schedule");
  await page.getByRole("button", { name: /Season 2025, change season/ }).click();
  await page.getByRole("button", { name: /^2027/ }).click();
  await expect(page.getByText("2027 season")).toBeVisible();

  await page.goto("/roster");
  await expect(page.getByText("2025 season")).toBeVisible();
  await page.goto("/schedule");
  await expect(page.getByText("2027 season")).toBeVisible();
});

test("search palette navigates to a screen", async ({ page }, info) => {
  await gotoHome(page);
  if (isPhone(info.project.name))
    await page.getByRole("button", { name: "Search", exact: true }).first().click();
  else await page.keyboard.press("ControlOrMeta+k");
  const input = page.getByPlaceholder("Search screens, seasons and actions");
  await expect(input).toBeVisible();
  await input.fill("Roster");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/roster$/);
});
