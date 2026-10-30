import type { Page } from "@playwright/test";
import { expect, expectNoHorizontalOverflow, isPhone, test } from "./fixtures";

const VIEWS = ["Overview", "Season", "League", "Trends", "Records", "Leaders", "Streaks"] as const;

async function openView(page: Page, view: (typeof VIEWS)[number]) {
  await page.goto("/stats");
  await expect(page.getByRole("heading", { level: 1, name: "Stats" })).toBeVisible();
  await page.getByRole("radio", { name: view, exact: true }).click();
}

for (const theme of ["dark", "light"] as const) {
  test.describe(`${theme} theme`, () => {
    test.use({ theme });

    test("every stats view loads without overflow", async ({ page }) => {
      // One load, then the tabs: a reload per view can catch a token refresh mid-flight and sign out.
      await openView(page, VIEWS[0]);
      for (const view of VIEWS) {
        await page.getByRole("radio", { name: view, exact: true }).click();
        await expectNoHorizontalOverflow(page);
      }
    });
  });
}

test("the overview leads with the season and opens the views behind it", async ({ page }) => {
  await openView(page, "Overview");
  await expect(page.getByText("Differential", { exact: true })).toBeVisible();
  await expect(page.getByText("Passing yards", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /Expected wins/ }).click();
  await expect(page.getByLabel("Show trends for")).toBeVisible();
});

test("trends chart the team, then any player on the roster", async ({ page }) => {
  await openView(page, "Trends");
  await expect(page.getByRole("heading", { name: "Results" })).toBeVisible();
  await page.getByLabel("Show trends for").selectOption({ label: "Drake Maye" });
  await expect(page.getByRole("heading", { name: "Cumulative" })).toBeVisible();
  await expect(page.getByLabel("Stat to chart")).toHaveValue("passYds");
  await expect(page.getByRole("table", { name: "Passing yards by season" })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test("season stats add up from the sample box scores", async ({ page }) => {
  await openView(page, "Season");
  await page.getByRole("radio", { name: "Regular season" }).click();
  // Every position group's table is on the page at once, no tabs.
  const table = page.getByRole("table", { name: "QB season stats" });
  await expect(table.getByText("Drake Maye")).toBeVisible();
  await expect(table.getByText("1,403")).toBeVisible();
  await expect(page.getByRole("radio", { name: "RB", exact: true })).toHaveCount(0);
  await expect(
    page.getByRole("table", { name: "RB season stats" }).getByText("TreVeyon Henderson"),
  ).toBeVisible();
});

test("league stats put our players beside the league's, with fantasy points", async ({ page }, testInfo) => {
  await openView(page, "League");
  const table = page.getByRole("table", { name: "QB league stats" });
  await expect(table.getByText("Drake Maye")).toBeVisible();
  await expect(table.getByText("Josh Allen")).toBeVisible();
  if (!isPhone(testInfo.project.name)) {
    await expect(table.getByRole("columnheader", { name: "FPTS", exact: true })).toBeVisible();
  }
  await page.getByRole("radio", { name: "Rest of league" }).click();
  // One search narrows every group's table.
  await page.getByLabel("Find a player or team").fill("Allen");
  await expect(table.getByText("Josh Allen")).toBeVisible();
  await page.getByLabel("Find a player or team").fill("");
  await expect(table.getByText("Josh Allen")).toBeVisible();
  await expect(table.getByText("Drake Maye")).toHaveCount(0);
  await page.getByRole("radio", { name: "Everyone" }).click();
  await expectNoHorizontalOverflow(page);
});

test("any player's season stats edit in place from League stats", async ({ page }) => {
  await openView(page, "League");
  // Every table has its own Edit; use the QB one.
  const qb = page.getByRole("region", { name: "QB", exact: true });
  const table = qb.getByRole("table", { name: "QB league stats" });
  const allen = table.getByRole("row").filter({ hasText: "Josh Allen" });
  await expect(allen).toBeVisible();
  await qb.getByRole("button", { name: "Edit", exact: true }).click();
  const tds = allen.getByRole("textbox", { name: "Passing touchdowns" });
  const before = await tds.inputValue();
  await tds.fill("40");
  await tds.press("Tab");
  await qb.getByRole("button", { name: "Done", exact: true }).click();
  await expect(allen.getByRole("cell", { name: "40", exact: true })).toBeVisible();
  // Put it back for the other tests sharing this backend.
  await qb.getByRole("button", { name: "Edit", exact: true }).click();
  await allen.getByRole("textbox", { name: "Passing touchdowns" }).fill(before);
  await allen.getByRole("textbox", { name: "Passing touchdowns" }).press("Tab");
  await qb.getByRole("button", { name: "Done", exact: true }).click();
  await expect(allen.getByRole("cell", { name: before, exact: true }).first()).toBeVisible();
});

test("league team stats: every team per Madden tab, rates computed from the counts", async ({ page }) => {
  await openView(page, "League");
  await page.getByRole("radio", { name: "Teams", exact: true }).click();
  await page.getByRole("radio", { name: "Turnovers", exact: true }).click();
  const table = page.getByRole("table", { name: "Turnovers team stats" });
  await expect(table.getByText("Dolphins")).toBeVisible();
  // Miami: 4 takeaways against 8 giveaways.
  await expect(table.getByRole("row").filter({ hasText: "Dolphins" }).getByText("-4")).toBeVisible();
  await page.getByRole("radio", { name: "Offense", exact: true }).click();
  await expect(page.getByRole("table", { name: "Offense team stats" }).getByText("Patriots")).toBeVisible();
  // New England: 1,950 offensive yards over its 5 games.
  await page.getByRole("radio", { name: "Per game", exact: true }).click();
  const perGame = page.getByRole("table", { name: "Offense team stats per game" });
  await expect(perGame.getByRole("row").filter({ hasText: "Patriots" }).getByText("390.0")).toBeVisible();
  await page.getByRole("radio", { name: "Totals", exact: true }).click();
  await expectNoHorizontalOverflow(page);
});

test("big-game counts always show and season highs link to their game", async ({ page }, testInfo) => {
  await openView(page, "Season");
  await page.getByRole("radio", { name: "Regular season" }).click();
  const table = page.getByRole("table", { name: "QB season stats" });
  const maye = table.getByRole("row").filter({ hasText: "Drake Maye" }).first();
  await expect(maye).toBeVisible();
  // Phones keep these columns in the tap-to-expand card.
  if (isPhone(testInfo.project.name)) {
    await maye.click();
    await expect(maye).toHaveAttribute("aria-expanded", "true");
    await expect(table.getByText("Big games: perfect passer rating")).toBeVisible();
  } else {
    await expect(table.getByRole("columnheader", { name: "158.3s", exact: true })).toBeVisible();
  }
  await table
    .getByRole("link", { name: /^W\d+$/ })
    .first()
    .click();
  await expect(page).toHaveURL(/\/games\//);
});

test("the records book, leaders and streaks", async ({ page }) => {
  await openView(page, "Records");
  await page.getByRole("radio", { name: "Franchise era", exact: true }).click();
  await page.getByRole("radio", { name: "Single game" }).click();
  const passing = page.getByRole("region", { name: "Passing yards records" });
  await expect(passing.getByText("342")).toBeVisible();
  await expect(passing.getByRole("link", { name: /W5 vs BUF/ })).toBeVisible();

  // The all-time book counts real seasons too: careers run back into the imported years.
  await page.getByRole("radio", { name: "All-time", exact: true }).click();
  await page.getByRole("radio", { name: "Career", exact: true }).click();
  const careers = page.getByRole("region", { name: "Passing yards records" });
  await expect(careers.getByText("Drake Maye")).toBeVisible({ timeout: 20_000 });
  // Other tests may commit later games, so only the start of the span is fixed.
  await expect(careers.getByText(/2024–20\d\d/).first()).toBeVisible();

  await page.getByRole("radio", { name: "Leaders", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "Passing yards leaders" }).getByText("Drake Maye"),
  ).toBeVisible();

  await page.getByRole("radio", { name: "Streaks", exact: true }).click();
  await expect(page.getByText("Games with a TD pass").first()).toBeVisible();
});

test("milestones can be acknowledged from Home", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Milestones" })).toBeVisible();
  const first = page.getByRole("button", { name: /^Acknowledge: / }).first();
  // Wait for the feed to load before counting: its loading state has neither.
  await expect(first.or(page.getByText("All caught up."))).toBeVisible();
  // The local backend is shared across runs: once every milestone is acknowledged the feed is empty.
  if ((await first.count()) === 0) {
    await expect(page.getByText("All caught up.")).toBeVisible();
    return;
  }
  const label = (await first.getAttribute("aria-label")) ?? "";
  // Other projects' box scores raise the same milestone for other weeks, so count down by one.
  const same = page.getByRole("button", { name: label, exact: true });
  const before = await same.count();
  await first.click();
  await expect(same).toHaveCount(before - 1);
  await expectNoHorizontalOverflow(page);
});

test("highlight thresholds save and restore", async ({ page }) => {
  await page.goto("/settings");
  // The season section; Game highlights under it has the same controls.
  const heading = page.getByRole("heading", { name: "Highlights", exact: true });
  await expect(heading).toBeVisible();
  const section = page.locator("section").filter({ has: heading });
  const tier1 = section.getByLabel("Rushing yards tier 1", { exact: true });
  await tier1.fill("900");
  await section.getByRole("button", { name: "Save highlights", exact: true }).click();
  await expect(section.getByText("Saved").first()).toBeVisible();
  await section.getByRole("button", { name: "Restore defaults" }).click();
  await expect(section.getByLabel("Rushing yards tier 1", { exact: true })).toHaveValue("1000");
});
