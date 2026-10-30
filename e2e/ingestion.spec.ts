import type { Page, TestInfo } from "@playwright/test";
import {
  SAMPLE_YEAR,
  createUndecidedPlayers,
  expect,
  expectNoHorizontalOverflow,
  isPhone,
  test,
} from "./fixtures";

/** A 1x1 PNG: the local e2e backend has no OpenRouter key, so the built-in sample answer reads it. */
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64",
);

/** Each project captures into its own week of the empty second season, so parallel runs never collide. */
const weekFor = (info: TestInfo) => ({ desktop: 1, phone: 2 })[info.project.name] ?? 3;

/** Opens the capture sheet from the phone's floating button or the header button, and returns it. */
async function openCapture(page: Page, info: TestInfo) {
  await page.goto("/inbox");
  await expect(page.getByRole("heading", { level: 1, name: "Inbox" })).toBeVisible();
  if (isPhone(info.project.name)) await page.locator('button[aria-label="Capture screenshots"]').click();
  else await page.getByRole("button", { name: "Capture", exact: true }).click();
  const sheet = page.getByRole("dialog", { name: "Capture" });
  await expect(sheet).toBeVisible();
  return sheet;
}

for (const theme of ["dark", "light"] as const) {
  test.describe(`${theme} theme`, () => {
    test.use({ theme });

    test("inbox and settings load without overflow", async ({ page }) => {
      await page.goto("/inbox");
      await expect(page.getByRole("radio", { name: /To do/ })).toBeVisible();
      await expectNoHorizontalOverflow(page);
      await page.goto("/settings");
      await expect(page.getByRole("heading", { name: "Extraction", exact: true })).toBeVisible();
      await expectNoHorizontalOverflow(page);
    });
  });
}

test("a full game log goes from capture to review to team and player stats", async ({ page }, info) => {
  const week = weekFor(info);
  const sheet = await openCapture(page, info);
  await expect(sheet.getByLabel("Screen", { exact: true })).toHaveValue("game_log");
  await sheet.getByLabel("Season", { exact: true }).selectOption({ label: String(SAMPLE_YEAR + 1) });
  await sheet.getByLabel("Week", { exact: true }).selectOption(`w${week}`);
  await sheet.getByLabel("Choose screenshots").setInputFiles([
    { name: "passing.png", mimeType: "image/png", buffer: PNG },
    { name: "rushing.png", mimeType: "image/png", buffer: PNG },
    { name: "team-stats.png", mimeType: "image/png", buffer: PNG },
  ]);
  await page.getByRole("button", { name: "Upload 3 screenshots" }).click();

  await expect(page).toHaveURL(/\/inbox\/.+/);
  await expect(page.getByRole("heading", { level: 1, name: "Full game log" })).toBeVisible();
  if (isPhone(info.project.name)) {
    await expect(page.getByRole("button", { name: "Screen 2" })).toBeVisible();
    await page.getByRole("radio", { name: "Draft" }).click();
  }
  await expect(page.getByRole("heading", { name: "Check first" })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("T. Henderson · Rushing yards")).toBeVisible();
  await expectNoHorizontalOverflow(page);

  const total = page.getByLabel("Total yards (pass + rush)", { exact: true }).first();
  await expect(total).toHaveValue("412");
  await expect(total).toHaveAttribute("readonly", "");
  await page
    .getByRole("group", { name: "Team stats draft" })
    .getByLabel("Passing yards", { exact: true })
    .first()
    .fill("300");
  await expect(total).toHaveValue("428");
  // Accept a computed score recommendation without typing the recommended number.
  await page.getByLabel("Score", { exact: true }).nth(1).fill("30");
  await page.getByRole("button", { name: "Apply 31 for Home score", exact: true }).click();
  await expect(page.getByLabel("Score", { exact: true }).nth(1)).toHaveValue("31");

  // Fix the doubtful player field in place, then commit.
  await page.getByLabel("T. Henderson · Rushing yards", { exact: true }).fill("110");
  await createUndecidedPlayers(page);
  await page.getByRole("button", { name: "Commit", exact: true }).click();

  await expect(page).toHaveURL(/\/games\//, { timeout: 20_000 });
  await expect(page.getByRole("heading", { level: 1, name: `W${week} vs Dolphins` })).toBeVisible();
  await expect(page.getByRole("table", { name: "NE passing" })).toBeVisible();
  await expect(page.getByText("3+ TD").first()).toBeVisible();
  await expect(page.getByRole("table", { name: "NE rushing" }).getByText("110")).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test("untagged screenshots wait in the inbox and can be deleted", async ({ page }, info) => {
  const sheet = await openCapture(page, info);
  await sheet.getByLabel("Screen", { exact: true }).selectOption("later");
  await page
    .getByLabel("Choose screenshots")
    .setInputFiles({ name: "later.png", mimeType: "image/png", buffer: PNG });
  await page.getByRole("button", { name: "Upload 1 screenshot" }).click();
  await expect(page).toHaveURL(/\/inbox$/);

  // Newest first: the set just uploaded leads the grid.
  const newest = page.getByRole("link").filter({ hasText: "Needs tags" }).first();
  await expect(newest).toBeVisible();
  const setKey = await newest.getAttribute("data-set");
  await page.getByRole("button", { name: "Select" }).click();
  await page.locator(`button[data-set="${setKey}"]`).click();
  await page.getByRole("button", { name: "Delete" }).click();
  await page.getByRole("button", { name: "Confirm delete" }).click();
  await expect(page.locator(`[data-set="${setKey}"]`)).toHaveCount(0);
});

test("Shortcut tokens can be created and revoked", async ({ page }, info) => {
  await page.goto("/settings");
  const label = `e2e ${info.project.name} ${Date.now()}`;
  await page.getByLabel("Token label").fill(label);
  await page.getByRole("button", { name: "New token" }).click();
  await expect(page.getByText("It is not shown again")).toBeVisible();
  await expect(page.getByLabel("Token", { exact: true })).toHaveValue(/^ft_/);
  const row = page.getByRole("listitem").filter({ hasText: label });
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: "Revoke" }).click();
  await expect(row).toHaveCount(0);
});

test("a saved model shows up in the model pickers and can be removed", async ({ page }, info) => {
  await page.goto("/settings");
  const model = `e2e/${info.project.name}-${Date.now()}`;
  await page.getByLabel("Model to save").fill(model);
  await page.getByRole("button", { name: "Add", exact: true }).click();
  const saved = page
    .getByRole("list", { name: "Saved models" })
    .getByRole("listitem")
    .filter({ hasText: model });
  await expect(saved).toBeVisible();
  await expect(
    page.getByLabel("Fallback model", { exact: true }).locator(`option[value="${model}"]`),
  ).toHaveCount(1);
  await expectNoHorizontalOverflow(page);

  await saved.getByRole("button", { name: `Remove ${model}` }).click();
  await expect(saved).toHaveCount(0);
  await expect(
    page.getByLabel("Fallback model", { exact: true }).locator(`option[value="${model}"]`),
  ).toHaveCount(0);
});
