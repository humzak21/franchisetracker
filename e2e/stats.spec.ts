import type { Page } from "@playwright/test";
import { expect, expectNoHorizontalOverflow, test } from "./fixtures";

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

test("the records book, leaders and streaks", async ({ page }) => {
  await openView(page, "Records");
  await page.getByRole("radio", { name: "Single game" }).click();
  const passing = page.getByRole("article").filter({ hasText: "Passing yards" });
  await expect(passing.getByText("342")).toBeVisible();
  await expect(passing.getByRole("link", { name: /W5 vs BUF/ })).toBeVisible();

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
  // The local backend is shared across runs: once every milestone is acknowledged the feed is empty.
  if ((await first.count()) === 0) {
    await expect(page.getByText("All caught up.")).toBeVisible();
    return;
  }
  const label = (await first.getAttribute("aria-label")) ?? "";
  await first.click();
  await expect(page.getByRole("button", { name: label, exact: true })).toHaveCount(0);
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
