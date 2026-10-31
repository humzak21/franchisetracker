import type { Page } from "@playwright/test";
import { expect, expectNoHorizontalOverflow, png, test } from "./fixtures";

async function openBatch(page: Page) {
  await page.goto("/inbox/weekly-awards");
  await expect(page.getByRole("heading", { level: 1, name: "Weekly awards" })).toBeVisible();
  await expect(page.getByRole("list", { name: "Weeks" })).toBeVisible();
}

for (const theme of ["dark", "light"] as const) {
  test.describe(`${theme} theme`, () => {
    test.use({ theme });

    test("season awards and the weekly awards batch load without overflow", async ({ page }) => {
      await page.goto("/awards");
      await page.getByRole("radio", { name: /^Season/ }).click();
      await expect(page.getByText("Not awarded yet")).toBeVisible();
      await expectNoHorizontalOverflow(page);
      await openBatch(page);
      await expectNoHorizontalOverflow(page);
    });
  });
}

test("the race lists the leaders, with our players marked, without overflow", async ({ page }) => {
  await page.goto("/awards");
  await page.getByRole("radio", { name: "Race", exact: true }).click();
  const mvp = page.getByRole("region", { name: "Most Valuable Player race" });
  await expect(mvp.getByRole("link", { name: "Drake Maye" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Defensive Player of the Year race" })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test("Coach of the Year goes to a coach created on the spot", async ({ page }) => {
  await page.goto("/awards");
  await page.getByRole("radio", { name: /^Season/ }).click();
  // Another run may have given the award already: then it is reassigned from its card.
  const menu = page.getByRole("button", { name: "Coach of the Year actions" });
  if (await menu.count()) {
    await menu.click();
    await page.getByRole("button", { name: "Assign winner" }).click();
  } else {
    await page.getByText("Not awarded yet").click();
    await page.getByRole("button", { name: "Coach of the Year" }).click();
  }
  const sheet = page.getByRole("dialog", { name: "Assign Coach of the Year" });
  await sheet.getByLabel("Search coaches").fill("andy re");
  await expect(sheet.getByRole("button", { name: /Andy Reid/ })).toBeVisible();

  const name = `E2E Coach ${Date.now()}`;
  await sheet.getByLabel("Search coaches").fill(name);
  await sheet.getByRole("button", { name: `Create “${name}”` }).click();
  await sheet.getByLabel("Team").selectOption("NE");
  await sheet.getByRole("button", { name: `Create ${name} and assign` }).click();
  await expect(page.getByRole("article").filter({ hasText: "Coach of the Year" })).toContainText(name);
});

test("weekly awards uploaded together, matched to weeks, read and committed", async ({ page }) => {
  await openBatch(page);
  await page
    .getByLabel("Weekly awards screenshots")
    .setInputFiles([{ name: "awards-17.png", mimeType: "image/png", buffer: png() }]);
  const card = page.getByRole("listitem").filter({ hasText: "Pick its week" }).first();
  await card.getByLabel("Week").selectOption("w17");
  // A screenshot waiting for a week outranks awards already stored for it in the strip.
  const w17 = page.getByRole("list", { name: "Weeks" }).getByLabel(/^Week 17:/);
  await expect(w17).toHaveAccessibleName(/screenshot matched|two screenshots/);
  await page.getByRole("button", { name: /^Read/ }).click();
  await page.getByRole("button", { name: /^Commit \d+ ready/ }).click({ timeout: 30_000 });
  await expect(w17).toHaveAccessibleName("Week 17: awards stored", { timeout: 20_000 });
  await expectNoHorizontalOverflow(page);
});
