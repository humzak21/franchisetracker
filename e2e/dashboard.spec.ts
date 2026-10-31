import type { Page } from "@playwright/test";
import { SAMPLE_FRANCHISE, expect, expectNoHorizontalOverflow, gotoHome, isPhone, test } from "./fixtures";

// The backend is shared by every project, so these tests never switch the active franchise:
// switching is covered by convex/franchise/switch.test.ts. Here the switcher is only opened.

const SECOND_FRANCHISE = "Sample Dynasty";

/** Opens a screen with one of its remembered views (the Segmented choice lives in localStorage). */
async function openView(page: Page, path: string, key: string, view: string) {
  await page.addInitScript(([k, v]) => localStorage.setItem(k, JSON.stringify(v)), [key, view] as const);
  await page.goto(path);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.locator("[aria-busy=true]")).toHaveCount(0, { timeout: 20_000 });
}

async function openPalette(page: Page, phone: boolean) {
  if (phone) await page.getByRole("button", { name: "Search", exact: true }).first().click();
  else await page.keyboard.press("ControlOrMeta+k");
  const input = page.getByPlaceholder("Search players, games, screens and actions");
  await expect(input).toBeVisible();
  return input;
}

for (const theme of ["dark", "light"] as const) {
  test.describe(`${theme} theme`, () => {
    test.use({ theme });

    test("home and the Sprint 8 views load without overflow", async ({ page }) => {
      await gotoHome(page);
      await expectNoHorizontalOverflow(page);
      for (const [path, key, view] of [
        ["/schedule", "ft.schedule-view", "calendar"],
        ["/schedule", "ft.schedule-view", "charts"],
        ["/league", "ft.league-view", "rivals"],
        ["/stats", "ft.stats-view", "team"],
      ] as const) {
        await openView(page, path, key, view);
        await expectNoHorizontalOverflow(page);
      }
      await page.goto("/franchises/new");
      await expect(page.getByRole("heading", { level: 1, name: "New franchise" })).toBeVisible();
      await expectNoHorizontalOverflow(page);
    });
  });
}

test("home leads with the season, the last result and the next opponent", async ({ page }, info) => {
  await gotoHome(page);
  const main = page.getByRole("main");
  await expect(main.getByText("Inbox", { exact: true })).toBeVisible();
  await expect(main.getByText("Regular season").first()).toBeVisible();
  await expect(main.getByRole("link", { name: /vs Miami Dolphins/ })).toBeVisible();
  await expect(main.getByText("Drake Maye").first()).toBeVisible();
  await expect(main.getByRole("img", { name: /Points by week/ })).toBeVisible();
  await expect(main.getByRole("meter", { name: "Points per game rank" })).toBeVisible();

  if (isPhone(info.project.name)) {
    // One column, with the inbox above the season header (FEATURES.md 5.13).
    const inbox = await main.getByText("Inbox", { exact: true }).boundingBox();
    const header = await main.getByRole("heading", { name: SAMPLE_FRANCHISE }).boundingBox();
    expect(inbox!.y).toBeLessThan(header!.y);
  }

  await main.getByRole("link", { name: /vs Miami Dolphins/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Miami Dolphins" })).toBeVisible();
});

test("the season checklist opens on the week, with the season's coverage below", async ({ page }) => {
  await gotoHome(page);
  const main = page.getByRole("main");
  await expect(main.getByRole("heading", { name: "Season checklist" })).toBeVisible();
  await expect(main.getByRole("heading", { name: "This week" })).toBeVisible();
  await expect(main.getByText("Weekly awards", { exact: true }).first()).toBeVisible();
  await expect(main.getByText("Box scores", { exact: true })).toBeVisible();
  await main.locator("summary", { hasText: "Offseason" }).click();
  await expect(main.getByRole("button", { name: /Draft class/ })).toBeVisible();
});

test("the palette finds players and games", async ({ page }, info) => {
  const phone = isPhone(info.project.name);
  await gotoHome(page);
  let input = await openPalette(page, phone);
  await input.fill("maye");
  await page.getByRole("option", { name: /Drake Maye/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Drake Maye" })).toBeVisible();

  input = await openPalette(page, phone);
  await input.fill("steelers");
  await page.getByRole("option", { name: /2026 Week 3 vs PIT/ }).click();
  await expect(page).toHaveURL(/\/games\//);
  await expect(page.getByRole("heading", { level: 1, name: /Steelers/ })).toBeVisible();
});

test("the calendar places each game on its Sunday", async ({ page }) => {
  await openView(page, "/schedule", "ft.schedule-view", "calendar");
  const september = page.getByRole("region", { name: "September 2026" });
  await expect(september.getByRole("link", { name: /vs LV · W 31-17/ })).toBeVisible();
  await expect(page.getByRole("region", { name: "April 2027" }).getByText("Draft").first()).toBeVisible();
  await september.getByRole("link", { name: /vs LV · W 31-17/ }).click();
  await expect(page).toHaveURL(/\/games\//);
});

test("rivals list every opponent with the record against them", async ({ page }) => {
  await openView(page, "/league", "ft.league-view", "rivals");
  const steelers = page.getByRole("row").filter({ hasText: "Steelers" });
  await expect(steelers).toContainText("0-1");
  await expect(steelers).toContainText("L1");
});

test("the franchise switcher lists every franchise and starts a new one", async ({ page }, info) => {
  await gotoHome(page);
  let list;
  if (isPhone(info.project.name)) {
    await page.getByRole("button", { name: "More" }).click();
    list = page.getByRole("dialog", { name: "More" });
  } else {
    await page.getByRole("button", { name: `${SAMPLE_FRANCHISE}: switch franchise` }).click();
    list = page.getByRole("dialog");
  }
  const franchises = list.getByRole("list", { name: "Franchises" });
  await expect(franchises.getByRole("button", { name: new RegExp(SAMPLE_FRANCHISE) })).toHaveAttribute(
    "aria-current",
    "true",
  );
  await expect(franchises.getByRole("button", { name: new RegExp(SECOND_FRANCHISE) })).toBeVisible();
  await list.getByRole("link", { name: "New franchise" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "New franchise" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Create franchise" })).toBeDisabled();
  await expectNoHorizontalOverflow(page);
});

test("settings lists the franchises", async ({ page }) => {
  await page.goto("/settings");
  await expect(page.getByRole("heading", { name: "Franchises" })).toBeVisible();
  await expect(page.getByRole("button", { name: `Switch to ${SECOND_FRANCHISE}` })).toBeVisible();
  await expect(page.getByText("Active", { exact: true })).toBeVisible();
});
