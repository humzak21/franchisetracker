import type { Page, TestInfo } from "@playwright/test";
import { SAMPLE_YEAR, expect, expectNoHorizontalOverflow, isPhone, png, test } from "./fixtures";

// Every project shares one backend: these commits are upserts of the same sample rows, so
// running them in parallel converges on the same data. Only the desktop project settles a
// reconciliation difference, so the phones never see it flip underneath them.

async function capture(page: Page, info: TestInfo, target: string, shots: number) {
  await page.goto("/inbox");
  await expect(page.getByRole("heading", { level: 1, name: "Inbox" })).toBeVisible();
  if (isPhone(info.project.name)) await page.locator('button[aria-label="Capture screenshots"]').click();
  else await page.getByRole("button", { name: "Capture", exact: true }).click();
  const sheet = page.getByRole("dialog", { name: "Capture" });
  await sheet.getByLabel("Screen", { exact: true }).selectOption(target);
  await sheet.getByLabel("Season", { exact: true }).selectOption({ label: String(SAMPLE_YEAR) });
  // Season screens are filed under the season alone.
  await expect(sheet.getByLabel("Week", { exact: true })).toHaveCount(0);
  await sheet.getByLabel("Choose screenshots").setInputFiles(
    Array.from({ length: shots }, (_, i) => ({
      name: `shot${i}.png`,
      mimeType: "image/png",
      buffer: png(),
    })),
  );
  await page.getByRole("button", { name: `Upload ${shots} screenshot${shots === 1 ? "" : "s"}` }).click();
  await expect(page).toHaveURL(/\/inbox\/.+/);
  if (isPhone(info.project.name)) await page.getByRole("radio", { name: "Draft" }).click();
  await expect(page.getByRole("heading", { name: "Rows" })).toBeVisible({ timeout: 20_000 });
}

for (const theme of ["dark", "light"] as const) {
  test.describe(`${theme} theme`, () => {
    test.use({ theme });
    test("reconcile and settings load without overflow", async ({ page }) => {
      await page.goto("/stats/reconcile");
      await expect(page.getByRole("heading", { level: 1, name: "Reconcile" })).toBeVisible();
      await expect(page.locator("[aria-busy=true]")).toHaveCount(0, { timeout: 20_000 });
      await expectNoHorizontalOverflow(page);
      await page.goto("/settings");
      await expect(page.getByRole("heading", { name: "Usage and cost" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Correction memory" })).toBeVisible();
      await expectNoHorizontalOverflow(page);
    });
  });
}

test("a standings screen is reviewed as row cards, accepted row by row and committed", async ({
  page,
}, info) => {
  await capture(page, info, "standings", 2);
  await expect(page.getByText("3 of 4 accepted")).toBeVisible();
  // The doubtful row waits for its own accept.
  const nyj = page.getByRole("button", { name: "Accept NYJ" });
  await expect(nyj).toHaveAttribute("aria-pressed", "false");
  await nyj.click();
  await expect(page.getByText("4 of 4 accepted")).toBeVisible();
  await expectNoHorizontalOverflow(page);
  const review = page.url();
  await page.getByRole("button", { name: "Commit 4 rows" }).click();
  // A list moves on to the next set waiting for review, or back to the inbox.
  await expect(page).not.toHaveURL(review, { timeout: 20_000 });
  await page.goto(review);
  await expect(page.getByText("Committed. The accepted rows are saved")).toBeVisible();
});

test("season stats land in reconciliation, where a difference can be settled", async ({ page }, info) => {
  await capture(page, info, "season_player_stats", 1);
  await page.getByRole("button", { name: /^Commit \d+ rows?$/ }).click();
  await expect(page).toHaveURL(/\/stats\/reconcile$/, { timeout: 20_000 });
  const card = page
    .getByRole("article")
    .filter({ hasText: "Drake Maye" })
    .filter({ hasText: "Passing yards" });
  await expect(card).toBeVisible();
  await expect(card.getByText("+47")).toBeVisible();
  await expectNoHorizontalOverflow(page);
  if (info.project.name !== "desktop") return;
  // A local backend reused across runs may hold it settled already.
  const reopen = card.getByRole("button", { name: "Reopen" });
  if (await reopen.isVisible()) await reopen.click();
  await card.getByRole("button", { name: "Missing game" }).click();
  await expect(card.getByText("Missing game", { exact: true })).toBeVisible();
  await card.getByRole("button", { name: "Reopen" }).click();
  await expect(card.getByRole("button", { name: "Use log number" })).toBeVisible();

  // Every difference at once: pick them all, settle, then reopen them all the same way.
  const section = (title: string) =>
    page.locator("section").filter({ has: page.getByRole("heading", { name: title, exact: true }) });
  const bar = (title: string) => section(title).getByRole("toolbar", { name: "Selection" });
  await bar("Differences")
    .getByRole("button", { name: /^Select all \d+$/ })
    .click();
  await bar("Differences").getByRole("button", { name: "Use log numbers" }).click();
  await expect(page.getByText("Everything is settled")).toBeVisible();
  await bar("Settled")
    .getByRole("button", { name: /^Select all \d+$/ })
    .click();
  await bar("Settled").getByRole("button", { name: "Reopen" }).click();
  await expect(card.getByRole("button", { name: "Use log number" })).toBeVisible();
});
