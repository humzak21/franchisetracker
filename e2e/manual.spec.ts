import type { Page } from "@playwright/test";
import { SAMPLE_YEAR, expect, expectNoHorizontalOverflow, test } from "./fixtures";

// Every project shares one backend. Each test starts its own entry; committing the same award
// twice is skipped as a duplicate, so parallel runs converge on the same data.

async function start(page: Page, target: string, week?: string) {
  await page.goto("/inbox");
  await expect(page.getByRole("heading", { level: 1, name: "Inbox" })).toBeVisible();
  await page.getByRole("link", { name: "Enter manually" }).first().click();
  await expect(page.getByRole("heading", { level: 1, name: "Enter manually" })).toBeVisible();
  await page.getByLabel("Screen", { exact: true }).selectOption(target);
  await page.getByLabel("Season", { exact: true }).selectOption({ label: String(SAMPLE_YEAR) });
  if (week) await page.getByLabel("Week", { exact: true }).selectOption(week);
  await page.getByRole("button", { name: "Start entering" }).click();
  await expect(page).toHaveURL(/\/inbox\/manual\/.+/, { timeout: 20_000 });
}

for (const theme of ["dark", "light"] as const) {
  test.describe(`${theme} theme`, () => {
    test.use({ theme });
    test("manual entry starts from the inbox and loads without overflow", async ({ page }) => {
      await start(page, "standings");
      await expect(page.getByRole("heading", { level: 1, name: "Standings" })).toBeVisible();
      await expect(page.getByText("No rows yet. Add the first one.")).toBeVisible();
      await page.getByRole("button", { name: "Add row" }).click();
      await expect(page.getByText("1 of 1 accepted")).toBeVisible();
      await expectNoHorizontalOverflow(page);
      // An abandoned entry waits in the inbox until it is finished or discarded.
      await page.getByRole("button", { name: "Discard" }).click();
      await page.getByRole("button", { name: "Confirm discard" }).click();
      await expect(page).toHaveURL(/\/inbox$/);
    });
  });
}

test("a yearly award typed in by hand commits and shows on the awards screen", async ({ page }) => {
  await start(page, "yearly_awards");
  await page.getByRole("button", { name: "Add row" }).click();
  const sheet = page.getByRole("dialog", { name: "Add a row" });
  await sheet.getByLabel("Player name").fill("Drake Maye");
  await sheet
    .getByRole("region", { name: "Matching players" })
    .getByRole("button", { name: /Drake Maye/ })
    .click();
  await page.getByLabel("Award", { exact: true }).selectOption("MVP");
  await page.getByLabel("Team", { exact: true }).selectOption("NE");
  await page.getByRole("button", { name: "Commit 1 row" }).click();
  await expect(page).toHaveURL(/\/awards$/, { timeout: 20_000 });
  await expectNoHorizontalOverflow(page);
});

test("a score typed under more fields keeps focus for every digit", async ({ page }) => {
  await start(page, "league_schedule", "w1");
  await page.getByRole("button", { name: "Add row" }).click();
  await page.getByRole("button", { name: /more field/ }).click();
  const away = page.getByLabel("Away score", { exact: true });
  await away.click();
  await page.keyboard.type("24");
  await expect(away).toHaveValue("24");
  await expect(away).toBeFocused();
  await page.getByRole("button", { name: "Discard" }).click();
  await page.getByRole("button", { name: "Confirm discard" }).click();
});

test("the draft screen links to manual entry with the target preset", async ({ page }) => {
  await page.goto("/draft");
  await page.getByRole("link", { name: "Add picks" }).click();
  await expect(page).toHaveURL(/\/inbox\/manual\?.*target=draft_results/);
  await expect(page.getByLabel("Screen", { exact: true })).toHaveValue("draft_results");
  await expectNoHorizontalOverflow(page);
});

test("a draft pick works out its overall number and takes a typed name for a new player", async ({ page }) => {
  await start(page, "draft_results");
  await page.getByRole("button", { name: "Add row" }).click();
  const add = page.getByRole("dialog", { name: "Add a row" });
  await add.getByLabel("Player name").fill("M.Hawkins");
  await add.getByRole("button", { name: "Add “M.Hawkins” as a new player" }).click();
  await page.getByLabel("Round", { exact: true }).fill("4");
  await page.getByLabel("Pick", { exact: true }).fill("32");
  await expect(page.getByText("No. 128 overall")).toBeVisible();

  await page.getByRole("button", { name: /^M\.Hawkins/ }).click();
  const picker = page.getByRole("dialog", { name: "M.Hawkins" });
  await picker.getByLabel("Search players").fill("Marcellous Hawkins");
  await picker.getByRole("button", { name: "Add “Marcellous Hawkins” as a new player" }).click();
  await expect(page.getByRole("button", { name: "Accept Marcellous Hawkins" })).toBeVisible();
  await page.getByRole("button", { name: "Discard" }).click();
  await page.getByRole("button", { name: "Confirm discard" }).click();
});
