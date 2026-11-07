import type { Page } from "@playwright/test";
import { SAMPLE_YEAR, createUndecidedPlayers, expect, expectNoHorizontalOverflow, test } from "./fixtures";

/**
 * A game as `npm run export:madden` writes it, in a week of the empty second season no other
 * spec uses (`ingestion.spec.ts` and `scoring.spec.ts` take weeks 1 to 6).
 */
const gameFile = (week: number) => ({
  name: `w${week}-MIA-at-NE.json`,
  mimeType: "application/json",
  buffer: Buffer.from(
    JSON.stringify({
      year: SAMPLE_YEAR + 1,
      week: `w${week}`,
      awayAbbr: "MIA",
      homeAbbr: "NE",
      played: true,
      awayScore: 7,
      homeScore: 10,
      overtime: false,
      lineScore: { home: [3, 0, 7, 0], away: [0, 7, 0, 0] },
      lines: [
        {
          teamAbbr: "NE",
          name: "Drake Maye",
          position: "QB",
          stats: { passCmp: 19, passAtt: 27, passYds: 233 },
        },
        { teamAbbr: "MIA", name: "File Receiver", position: "WR", stats: { rec: 4, recYds: 52 } },
      ],
      teams: [
        { teamAbbr: "MIA", stats: { passYds: 190, rushYds: 70 } },
        { teamAbbr: "NE", stats: { passYds: 233, rushYds: 88 } },
      ],
      plays: [
        {
          order: 1,
          period: 1,
          clock: 300,
          teamAbbr: "NE",
          kind: "fg",
          pat: null,
          homeScore: 3,
          awayScore: 0,
        },
        {
          order: 2,
          period: 2,
          clock: 90,
          teamAbbr: "MIA",
          kind: "other",
          pat: "kick",
          homeScore: 3,
          awayScore: 7,
        },
        {
          order: 3,
          period: 3,
          clock: 45,
          teamAbbr: "NE",
          kind: "other",
          pat: "kick",
          homeScore: 10,
          awayScore: 7,
        },
      ],
    }),
  ),
});

const notJson = { name: "notes.json", mimeType: "application/json", buffer: Buffer.from("{nope") };

async function openInbox(page: Page) {
  await page.goto("/inbox");
  await expect(page.getByRole("heading", { level: 1, name: "Inbox" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Import game file" })).toBeVisible();
}

for (const [theme, week] of [
  ["dark", 11],
  ["light", 12],
] as const) {
  test.describe(`${theme} theme`, () => {
    test.use({ theme });
    test("game files import from the inbox without overflow", async ({ page }) => {
      await openInbox(page);
      await page.getByLabel("Game files").setInputFiles([gameFile(week), notJson]);
      const sheet = page.getByRole("dialog", { name: "Game files" });
      await expect(sheet.getByText("1 of 2 filed for review")).toBeVisible({ timeout: 20_000 });
      await expect(sheet.getByText("This file is not JSON")).toBeVisible();
      await expectNoHorizontalOverflow(page);
      await sheet.getByRole("link", { name: new RegExp(`Week ${week} · MIA at NE`) }).click();
      await expect(page.getByRole("heading", { level: 1, name: "Full game log" })).toBeVisible();
      // The away team's players come first.
      await expect(page.getByRole("heading", { level: 2, name: "Players" })).toBeVisible();
      await expect(page.getByText("File Receiver").first()).toBeVisible();
      await expectNoHorizontalOverflow(page);
    });
  });
}

test("one game file opens in review and commits as the week's game", async ({ page }) => {
  await openInbox(page);
  await page.getByLabel("Game files").setInputFiles([gameFile(10)]);
  await expect(page).toHaveURL(/\/inbox\/manual\/.+/, { timeout: 20_000 });
  await expect(page.getByRole("heading", { level: 1, name: "Full game log" })).toBeVisible();
  await createUndecidedPlayers(page);
  await page.getByRole("button", { name: "Commit", exact: true }).click();
  await expect(page).toHaveURL(/\/games\//, { timeout: 20_000 });
  await expect(page.getByRole("heading", { level: 1, name: "W10 vs Dolphins" })).toBeVisible();
  await expect(page.getByRole("table", { name: "NE passing" }).getByText("233")).toBeVisible();
  // The game page takes a file too; one for another week is refused there.
  await page.getByLabel("Game files").setInputFiles([gameFile(11)]);
  await expect(page.getByRole("dialog", { name: "Game files" }).getByText(/not this game/)).toBeVisible({
    timeout: 20_000,
  });
});
