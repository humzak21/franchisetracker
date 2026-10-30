import type { Page } from "@playwright/test";
import { expect, expectNoHorizontalOverflow, test } from "./fixtures";

async function openDiggs(page: Page) {
  await page.goto("/roster");
  await page
    .getByRole("link", { name: /Stefon Diggs/ })
    .first()
    .click({ timeout: 20_000 });
  await expect(page.getByRole("heading", { level: 1, name: "Stefon Diggs" })).toBeVisible();
}

test("player page shows the hero, career stats with totals and roster history", async ({ page }) => {
  await openDiggs(page);
  await expect(page.getByRole("heading", { level: 2, name: "Stefon Diggs" })).toBeVisible();
  await expect(page.getByRole("figure").getByText("Stefon Diggs")).toBeVisible();
  const career = page.getByRole("table", { name: "Career stats" });
  await expect(career).toBeVisible();
  await expect(career.locator("tfoot").getByText("Career")).toBeVisible();
  await expect(page.getByRole("table", { name: "Roster history" })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test("the identity panel says where a player has been seen", async ({ page }) => {
  await openDiggs(page);
  const identity = page.locator("#identity");
  await expect(identity.getByText("Seen in", { exact: true })).toBeVisible();
  await expect(identity.getByText("NFL history import")).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test("the player page shows a career as curves without overflow", async ({ page }) => {
  await openDiggs(page);
  await expect(page.getByRole("heading", { name: "Trends" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Cumulative" })).toBeVisible();
  await expect(page.getByRole("table", { name: /by season$/ })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test("player notes save on blur", async ({ page }) => {
  await openDiggs(page);
  const notes = page.getByLabel("Scouting notes");
  // The local backend may hold real imported notes: restore them at the end.
  const original = await notes.inputValue();
  const text = `Route runner, checked ${Date.now()}`;
  await notes.fill(text);
  await notes.blur();
  await expect(page.getByText("Saved")).toBeVisible();
  await page.reload();
  const reloaded = page.getByLabel("Scouting notes");
  await expect(reloaded).toHaveValue(text);

  await reloaded.fill(original);
  await reloaded.blur();
  await expect(page.getByText("Saved")).toBeVisible();
});

test("Edit opens the player's facts and Move opens the move and transaction sheets", async ({ page }) => {
  await openDiggs(page);
  await page.getByRole("button", { name: "Edit", exact: true }).first().click();
  const sheet = page.getByRole("dialog", { name: "Edit player" });
  await expect(sheet.getByRole("textbox").first()).toHaveValue("Stefon");
  await sheet.getByRole("button", { name: "Cancel" }).click();
  await expect(sheet).toHaveCount(0);
  await page.getByRole("button", { name: "Move", exact: true }).click();
  await page.getByRole("button", { name: "Move team or status" }).click();
  await expect(page.getByRole("dialog", { name: "Move Stefon Diggs" })).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).click();

  // A trade started here already has him on his team's side.
  await page.getByRole("button", { name: "Move", exact: true }).click();
  await page.getByRole("button", { name: "Record trade" }).click();
  const trade = page.getByRole("dialog", { name: "Record a trade" });
  await expect(trade.getByRole("group", { name: "Team A" })).toContainText("Stefon Diggs");
  await page.keyboard.press("Escape");
  await expect(trade).toBeHidden();
});

test("roster history edits inline", async ({ page }) => {
  await openDiggs(page);
  const history = page.locator("section#rosters");
  await history.getByRole("button", { name: "Edit", exact: true }).click();
  await expect(history.getByRole("textbox").first()).toBeVisible();
  await history.getByRole("button", { name: "Done" }).click();
  await expect(history.getByRole("textbox")).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
});

test("back returns to the screen the player was opened from", async ({ page }) => {
  await openDiggs(page);
  await page.getByRole("link", { name: "Back", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Roster" })).toBeVisible();
});

test("back on a directly opened player page goes to the players index", async ({ page }) => {
  await openDiggs(page);
  // A new tab has no app history behind it, like opening a shared link.
  const fresh = await page.context().newPage();
  await fresh.goto(page.url());
  await fresh.getByRole("link", { name: "Back to Players" }).click();
  await expect(fresh.getByRole("heading", { level: 1, name: "Players" })).toBeVisible();
});

test("real NFL seasons come before the franchise ones, marked, with a game log after", async ({ page }) => {
  await page.goto("/roster");
  await page
    .getByRole("link", { name: /Drake Maye/ })
    .first()
    .click({ timeout: 20_000 });
  await expect(page.getByRole("heading", { level: 2, name: "Drake Maye" })).toBeVisible();
  const career = page.getByRole("table", { name: "Career stats" });
  await expect(career.getByTitle("Real NFL season before the franchise")).toHaveCount(2);
  // The log opens on the latest logged season; other specs may have committed a newer game.
  await expect(
    page
      .getByRole("table", { name: "Game log" })
      .getByRole("link", { name: /^W\d+$/ })
      .first(),
  ).toBeVisible();
  await page.getByRole("link", { name: "OVR", exact: true }).click();
  await expect(page.getByRole("heading", { name: "OVR progression" })).toBeInViewport();
  await expectNoHorizontalOverflow(page);
});
