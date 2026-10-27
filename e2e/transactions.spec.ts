import type { Locator, Page } from "@playwright/test";
import { expect, expectNoHorizontalOverflow, test } from "./fixtures";

/** Names are unique per run: every project records into the same e2e backend. */
const unique = (what: string) => `${what} ${Date.now()}${Math.floor(Math.random() * 1000)}`;

async function openView(page: Page, view: RegExp) {
  await page.goto("/transactions");
  await page.getByRole("radio", { name: view }).click();
}

/** Adds a player typed by name through a picker's "New player" mode. */
async function addNewPlayer(scope: Locator, label: string, name: string) {
  await scope.getByRole("radio", { name: "New player" }).click();
  await scope.getByLabel(`${label}: new player name`).fill(name);
  await scope.getByRole("button", { name: `Add ${name}` }).click();
}

/** Deletes from an edit sheet: Delete, then confirm. */
async function deleteFrom(sheet: Locator) {
  await sheet.getByRole("button", { name: "Delete", exact: true }).click();
  await sheet.getByRole("button", { name: "Delete for good" }).click();
  await expect(sheet).toBeHidden();
}

for (const theme of ["dark", "light"] as const) {
  test.describe(`${theme} theme`, () => {
    test.use({ theme });

    test("the move sheets open without overflow", async ({ page }) => {
      await openView(page, /^Moves/);
      const sheets = [
        ["Record trade", "Record a trade"],
        ["Sign free agent", "Sign a free agent"],
        ["Other move", "Record a move"],
      ] as const;
      for (const [button, title] of sheets) {
        await page.getByRole("button", { name: button }).click();
        const sheet = page.getByRole("dialog", { name: title });
        await expect(sheet).toBeVisible();
        await expectNoHorizontalOverflow(page);
        await page.keyboard.press("Escape");
        await expect(sheet).toBeHidden();
      }
      await expectNoHorizontalOverflow(page);
    });
  });
}

test("record, edit and delete a free agent signing", async ({ page }) => {
  const name = unique("Signing Test");
  await openView(page, /^Moves/);
  await page.getByRole("button", { name: "Sign free agent" }).click();
  const sheet = page.getByRole("dialog", { name: "Sign a free agent" });
  await addNewPlayer(sheet, "Player", name);
  await sheet.getByLabel("Years").fill("2");
  await sheet.getByLabel("Total ($M)").fill("10");
  await sheet.getByLabel("When").selectOption({ label: "Free agency" });
  await sheet.getByRole("button", { name: "Record signing" }).click();
  await expect(sheet).toBeHidden();

  const card = page.getByRole("article").filter({ hasText: name });
  await expect(card).toContainText("Free agency");
  await expect(card).toContainText("$5.0M/yr");
  await card.getByRole("button", { name: "Edit signed" }).click();
  const edit = page.getByRole("dialog", { name: "Edit free agent signing" });
  await edit.getByLabel("Note (optional)").fill("Depth at corner");
  await edit.getByRole("button", { name: "Save" }).click();
  await expect(card).toContainText("Depth at corner");

  await card.getByRole("button", { name: "Edit signed" }).click();
  await deleteFrom(page.getByRole("dialog", { name: "Edit free agent signing" }));
  await expect(page.getByRole("article").filter({ hasText: name })).toHaveCount(0);
});

test("record and delete a trade with players and a pick", async ({ page }) => {
  const name = unique("Trade Test");
  await openView(page, /^Moves/);
  await page.getByRole("button", { name: "Record trade" }).click();
  const sheet = page.getByRole("dialog", { name: "Record a trade" });
  const teamA = sheet.getByRole("group", { name: "Team A" });
  const teamB = sheet.getByRole("group", { name: "Team B" });
  await teamB.getByLabel("Team", { exact: true }).selectOption({ label: "Kansas City Chiefs" });
  await addNewPlayer(teamA, "Team A player", name);
  await teamB.getByRole("button", { name: "Add team b pick" }).click();
  await sheet.getByLabel("When").selectOption({ label: "During the draft" });
  await sheet.getByRole("button", { name: "Record trade" }).click();
  await expect(sheet).toBeHidden();

  const card = page.getByRole("article").filter({ hasText: name });
  await expect(card).toContainText("During the draft");
  await expect(card).toContainText("with KC");
  await expect(card).toContainText("R1 pick");
  await expectNoHorizontalOverflow(page);
  await card.getByRole("button", { name: "Edit trade" }).click();
  await deleteFrom(page.getByRole("dialog", { name: "Edit trade" }));
  await expect(page.getByRole("article").filter({ hasText: name })).toHaveCount(0);
});

test("log, edit and delete an injury", async ({ page }) => {
  const name = unique("Injury Test");
  await openView(page, /^Injuries/);
  await page.getByRole("button", { name: "Log injury" }).click();
  const sheet = page.getByRole("dialog", { name: "Log an injury" });
  await addNewPlayer(sheet, "Player", name);
  await sheet.getByLabel("Injury", { exact: true }).fill("Turf toe");
  await sheet.getByLabel("Week", { exact: true }).selectOption({ label: "Week 3" });
  await sheet.getByRole("button", { name: "Log injury" }).click();
  await expect(sheet).toBeHidden();

  const item = page.getByRole("listitem").filter({ hasText: name });
  await expect(item).toContainText("Turf toe");
  await item.getByRole("button", { name: `Edit ${name} injury` }).click();
  const edit = page.getByRole("dialog", { name: "Edit injury" });
  await edit.getByLabel("On injured reserve").check();
  await edit.getByRole("button", { name: "Save injury" }).click();
  await expect(item.getByText("IR", { exact: true })).toBeVisible();

  await item.getByRole("button", { name: `Edit ${name} injury` }).click();
  await deleteFrom(page.getByRole("dialog", { name: "Edit injury" }));
  await expect(page.getByRole("listitem").filter({ hasText: name })).toHaveCount(0);
});
