import type { Page, TestInfo } from "@playwright/test";
import { expect, expectNoHorizontalOverflow, isPhone, test } from "./fixtures";

/** A 1x1 PNG: the local e2e backend has no OpenRouter key, so the built-in sample answer reads it. */
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64",
);

/** Each project commits a different game, so parallel runs never rewrite each other's plays. */
const gameFor = (info: TestInfo) => (isPhone(info.project.name) ? 1 : 0);

async function openGame(page: Page, index: number) {
  await page.goto("/schedule");
  await expect(page.getByRole("heading", { level: 1, name: "Schedule" })).toBeVisible();
  await page.locator('a[href^="/games/"]').nth(Math.max(index, 0)).click();
  await expect(page).toHaveURL(/\/games\//);
}

for (const theme of ["dark", "light"] as const) {
  test.describe(`${theme} theme`, () => {
    test.use({ theme });

    test("a game's scoring section and the scoring records load without overflow", async ({ page }, info) => {
      await openGame(page, gameFor(info));
      await expect(
        page.getByRole("heading", { name: /^(Scoring summary|No scoring summary yet)$/ }),
      ).toBeVisible();
      await expectNoHorizontalOverflow(page);
      await page.goto("/stats");
      await page.getByRole("radio", { name: "Records", exact: true }).click();
      await expect(page.getByRole("radio", { name: "Franchise era" })).toBeVisible();
      await expectNoHorizontalOverflow(page);
    });
  });
}

test("a scoring summary goes from photos to a play list without overflow", async ({ page }, info) => {
  await openGame(page, gameFor(info));
  await page.getByRole("button", { name: "Import scoring summary" }).first().click();
  const sheet = page.getByRole("dialog", { name: "Capture" });
  await expect(sheet.getByLabel("Screen", { exact: true })).toHaveValue("scoring_plays");
  await sheet.getByLabel("Choose screenshots").setInputFiles([
    { name: "scoring-1.png", mimeType: "image/png", buffer: PNG },
    { name: "scoring-2.png", mimeType: "image/png", buffer: PNG },
  ]);
  await page.getByRole("button", { name: "Upload 2 screenshots" }).click();
  await expect(page).toHaveURL(/\/inbox\/.+/);
  if (isPhone(info.project.name)) await page.getByRole("radio", { name: "Draft" }).click();
  await expect(page.getByRole("heading", { name: "Rows" })).toBeVisible({ timeout: 20_000 });
  await expectNoHorizontalOverflow(page);

  // The row the screen dropped a name from waits in "Check first" with the box score's answer.
  const attention = page.getByRole("region", { name: "Check first" });
  await attention
    .getByRole("button", { name: /^Assign / })
    .first()
    .click();
  await expect(page.getByText("Needs a player")).toHaveCount(0);

  await page.getByRole("button", { name: /^Commit \d+ rows/ }).click();
  await expect(page).toHaveURL(/\/games\//, { timeout: 20_000 });
  await expect(page.getByRole("heading", { name: "Scoring summary" })).toBeVisible();
  await expect(page.getByText("Game-winning score:")).toBeVisible();
  await expect(page.getByText("From the scoring plays")).toBeVisible();
  await expect(page.getByRole("img", { name: /lead over the game/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "Edit quarter scores" })).toHaveCount(0);
  await expectNoHorizontalOverflow(page);

  // Any play's player can still be changed from the game page.
  await page
    .getByRole("button", { name: /^Change the player on / })
    .first()
    .click();
  const picker = page.getByRole("dialog", { name: "Who scored?" });
  await expect(picker.getByRole("list", { name: "Players" })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});
