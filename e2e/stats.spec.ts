import type { Page } from "@playwright/test";
import { expect, expectNoHorizontalOverflow, isPhone, test } from "./fixtures";

async function openView(page: Page, view: "Season" | "Records" | "Leaders" | "Streaks") {
  await page.goto("/stats");
  await expect(page.getByRole("heading", { level: 1, name: "Stats" })).toBeVisible();
  await page.getByRole("radio", { name: view, exact: true }).click();
}

for (const theme of ["dark", "light"] as const) {
  test.describe(`${theme} theme`, () => {
    test.use({ theme });

    test("every stats view loads without overflow", async ({ page }) => {
      for (const view of ["Season", "Records", "Leaders", "Streaks"] as const) {
        await openView(page, view);
        await expectNoHorizontalOverflow(page);
      }
    });
  });
}

test("season stats add up from the sample box scores", async ({ page }) => {
  await openView(page, "Season");
  await page.getByRole("radio", { name: "Regular season" }).click();
  await page.getByRole("radio", { name: "QB", exact: true }).click();
  const table = page.getByRole("table", { name: "QB season stats" });
  await expect(table.getByText("Drake Maye")).toBeVisible();
  await expect(table.getByText("1,403")).toBeVisible();
  await page.getByRole("radio", { name: "RB", exact: true }).click();
  await expect(
    page.getByRole("table", { name: "RB season stats" }).getByText("TreVeyon Henderson"),
  ).toBeVisible();
});

test("big-game counts always show and season highs link to their game", async ({ page }, testInfo) => {
  await openView(page, "Season");
  await page.getByRole("radio", { name: "Regular season" }).click();
  await page.getByRole("radio", { name: "QB", exact: true }).click();
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
  await expect(careers.getByText(/2024–2026/).first()).toBeVisible();

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
  await expect(page.getByRole("heading", { name: "Highlights" })).toBeVisible();
  const tier1 = page.getByLabel("Rushing yards tier 1");
  await tier1.fill("900");
  await page.getByRole("button", { name: "Save highlights" }).click();
  await expect(page.getByText("Saved").first()).toBeVisible();
  await page.getByRole("button", { name: "Restore defaults" }).click();
  await expect(page.getByLabel("Rushing yards tier 1")).toHaveValue("1000");
});
