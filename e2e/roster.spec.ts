import type { Locator, Page } from "@playwright/test";
import { SAMPLE_YEAR, expect, expectNoHorizontalOverflow, test } from "./fixtures";

/** The sample franchise's current season always has a roster: receivers, linebackers and a kicker. */
async function openRoster(page: Page) {
  await page.goto("/roster");
  await expect(page.getByRole("heading", { level: 1, name: "Roster" })).toBeVisible();
  await expect(page.getByText(`${SAMPLE_YEAR} season`)).toBeVisible();
  const receivers = page.getByRole("table", { name: `${SAMPLE_YEAR} wide receivers` });
  await expect(receivers.getByRole("link").first()).toBeVisible({ timeout: 20_000 });
  return receivers;
}

/**
 * Opens a row's actions menu; on phones the button sits in the row's expansion card, opened by
 * tapping a plain cell (the first links to the player, the last picks him).
 */
async function openActions(table: Locator, name: string) {
  const actions = table.getByRole("button", { name: `Actions for ${name}` });
  if (!(await actions.isVisible()))
    await table.getByRole("row").filter({ hasText: name }).getByRole("cell").nth(1).click();
  await actions.click();
}

for (const theme of ["dark", "light"] as const) {
  test.describe(`${theme} theme`, () => {
    test.use({ theme });

    test("roster renders a table per position group and the averages without overflow", async ({ page }) => {
      await openRoster(page);
      for (const group of ["wide receivers", "linebackers", "kickers"])
        await expect(page.getByRole("table", { name: `${SAMPLE_YEAR} ${group}` })).toBeVisible();
      await expect(page.getByRole("navigation", { name: "On this page" })).toBeVisible();
      await expect(page.getByText(/^Team · \d+$/)).toBeVisible();
      await expect(page.getByText("avg OVR").first()).toBeVisible();
      await expectNoHorizontalOverflow(page);
    });
  });
}

test("each position group's table holds only its positions", async ({ page }) => {
  const receivers = await openRoster(page);
  await expect(receivers.getByText("Stefon Diggs")).toBeVisible();
  await expect(receivers.getByText("Robert Spillane")).toHaveCount(0);
  const linebackers = page.getByRole("table", { name: `${SAMPLE_YEAR} linebackers` });
  await expect(linebackers.getByText("Robert Spillane")).toBeVisible();
  await expect(linebackers.getByText("Stefon Diggs")).toHaveCount(0);
  const kickers = page.getByRole("table", { name: `${SAMPLE_YEAR} kickers` });
  await expect(kickers.getByText("Andres Borregales")).toBeVisible();
  await expect(kickers.getByText("Stefon Diggs")).toHaveCount(0);
});

test("Edit turns a table's cells into inputs and Done turns them back", async ({ page }) => {
  await openRoster(page);
  const section = page.locator("section#pos-wr");
  await section.getByRole("button", { name: "Edit" }).click();
  await expect(section.getByRole("textbox", { name: "Player" }).first()).toBeVisible();
  await section.getByRole("button", { name: "Done" }).click();
  await expect(section.getByRole("textbox", { name: "Player" })).toHaveCount(0);
  await expect(section.getByRole("link", { name: /Stefon Diggs/ })).toBeVisible();
});

test("Add player and Move open their sheets", async ({ page }) => {
  await openRoster(page);
  await page.getByRole("button", { name: "Add player" }).click();
  await expect(page.getByRole("dialog", { name: "Add player" })).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("dialog", { name: "Add player" })).toHaveCount(0);

  const receivers = page.getByRole("table", { name: `${SAMPLE_YEAR} wide receivers` });
  await openActions(receivers, "Stefon Diggs");
  await page.getByRole("button", { name: "Move team or status" }).click();
  await expect(page.getByRole("dialog", { name: "Move Stefon Diggs" })).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).click();
});

test("a roster row starts an injury for that player", async ({ page }) => {
  const receivers = await openRoster(page);
  await openActions(receivers, "Stefon Diggs");
  await page.getByRole("button", { name: "Log injury" }).click();
  const sheet = page.getByRole("dialog", { name: "Log an injury" });
  await expect(sheet.getByRole("button", { name: "Remove Stefon Diggs" })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();
});

test("the roster counts its players and releases or trades a batch", async ({ page }) => {
  const receivers = await openRoster(page);
  await expect(page.getByText(new RegExp(`^\\d+ players · ${SAMPLE_YEAR} season$`))).toBeVisible();
  await receivers.getByRole("checkbox", { name: "Pick Stefon Diggs" }).click();
  await receivers.getByRole("checkbox", { name: "Pick DeMario Douglas" }).click();
  const bar = page.getByRole("toolbar", { name: "Selection" });
  await expect(bar.getByText("2 players selected")).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await bar.getByRole("button", { name: "Trade" }).click();
  const trade = page.getByRole("dialog", { name: "Record a trade" });
  await expect(trade.getByRole("button", { name: "Remove Stefon Diggs" })).toBeVisible();
  await expect(trade.getByRole("button", { name: "Remove DeMario Douglas" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(trade).toBeHidden();
});

test("a player row links to the player page", async ({ page }) => {
  const receivers = await openRoster(page);
  await receivers.getByRole("link", { name: /Stefon Diggs/ }).click();
  await expect(page).toHaveURL(/\/players\/[^/]+$/);
  await expect(page.getByRole("heading", { level: 1, name: "Stefon Diggs" })).toBeVisible();
});

test("a released player leaves the roster", async ({ page }) => {
  await openRoster(page);
  const name = `E2E Released ${Date.now()}`;
  await page.getByRole("button", { name: "Add player" }).click();
  const add = page.getByRole("dialog", { name: "Add player" });
  await add.getByPlaceholder("First Last").fill(name);
  await add.getByLabel("Position").selectOption("K");
  await add.getByRole("button", { name: "Add player" }).click();
  const kickers = page.getByRole("table", { name: `${SAMPLE_YEAR} kickers` });
  await expect(kickers.getByText(name)).toBeVisible();

  await openActions(kickers, name);
  await page.getByRole("button", { name: "Move team or status" }).click();
  const move = page.getByRole("dialog", { name: `Move ${name}` });
  await move.getByLabel("Status").selectOption("released");
  await move.getByRole("button", { name: "Move", exact: true }).click();
  await expect(page.getByText(name)).toHaveCount(0);
});
