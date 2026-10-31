import type { Locator } from "@playwright/test";
import { expect, expectNoHorizontalOverflow, isPhone, SAMPLE_YEAR, test } from "./fixtures";

// Every project shares one backend, so these tests only add and remove their own rows and never
// file a report or finish a season (lifecycle is covered by convex-test in convex/seasons).

const SCREENS = [
  "/history/reports",
  `/history/reports/${SAMPLE_YEAR}`,
  `/history/recaps/${SAMPLE_YEAR}`,
  "/history/hall-of-fame",
  "/history/timeline",
];

for (const theme of ["dark", "light"] as const) {
  test.describe(`${theme} theme`, () => {
    test.use({ theme });
    test("history screens load without overflow", async ({ page }) => {
      for (const path of SCREENS) {
        await page.goto(path);
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        await expect(page.locator("[aria-busy=true]")).toHaveCount(0, { timeout: 20_000 });
        await expectNoHorizontalOverflow(page);
      }
    });
  });
}

test("the pending pre-season report on Home opens its editor, which autosaves", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: new RegExp(`${SAMPLE_YEAR} pre-season report`) }).click();
  await expect(page).toHaveURL(new RegExp(`/history/reports/${SAMPLE_YEAR}$`));
  await expect(page.getByRole("heading", { name: "Pre-season report" })).toBeVisible();
  await expect(page.getByText("Due once the Super Bowl week is done.")).toBeVisible();
  const notes = page.getByLabel("Notes", { exact: true });
  await notes.fill(`Around the league, checked ${Date.now()}`);
  await notes.blur();
  await expect(page.getByText("Saved")).toBeVisible();
});

/** A finger swipe: touch pointer events, as a phone sends them, on the row's content. */
async function swipeLeft(row: Locator) {
  const surface = row.locator(".touch-pan-y");
  const box = (await surface.boundingBox())!;
  const y = box.y + box.height / 2;
  const at = (x: number) => ({ pointerId: 7, pointerType: "touch", isPrimary: true, clientX: x, clientY: y });
  const start = box.x + box.width - 20;
  await surface.dispatchEvent("pointerdown", at(start));
  for (let dx = 20; dx <= 180; dx += 20) await surface.dispatchEvent("pointermove", at(start - dx));
  await surface.dispatchEvent("pointerup", at(start - 180));
}

test("a need is added, resolved (by swipe on phones) and removed", async ({ page }, testInfo) => {
  const note = `E2E ${testInfo.project.name} ${Date.now()}`;
  await page.goto(`/history/reports/${SAMPLE_YEAR}`);
  await page.getByRole("button", { name: "Add need" }).click();
  const add = page.getByRole("dialog", { name: "Add a need" });
  await add.getByLabel("Note").fill(note);
  await add.getByRole("button", { name: "Add need" }).click();
  await expect(add).toBeHidden();

  const row = page.getByRole("listitem").filter({ hasText: note });
  await expect(row).toBeVisible();
  if (isPhone(testInfo.project.name)) await swipeLeft(row);
  else await row.getByRole("button", { name: /^Resolve/ }).click();
  const resolve = page.getByRole("dialog", { name: /^Resolve/ });
  await resolve.getByLabel("How it was resolved").fill("Signed a veteran");
  await resolve.getByRole("button", { name: "Resolve" }).click();
  await expect(row.getByText("Resolved · Signed a veteran")).toBeVisible();

  await row.getByRole("button", { name: /^Edit/ }).click();
  await page.getByRole("dialog", { name: "Edit need" }).getByRole("button", { name: "Remove" }).click();
  await expect(row).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
});

const INDUCTEE: Record<string, string> = {
  desktop: "Hunter Henry",
  phone: "DeMario Douglas",
};

test("a player is inducted from their page, hangs on the wall, and is removed", async ({
  page,
}, testInfo) => {
  const name = INDUCTEE[testInfo.project.name] ?? "Hunter Henry";
  const last = name.split(" ")[1]!;
  await page.goto("/roster");
  await page
    .getByRole("link", { name: new RegExp(name) })
    .first()
    .click({ timeout: 20_000 });
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();

  await page.getByRole("button", { name: "Hall of Fame", exact: true }).click();
  const sheet = page.getByRole("dialog", { name: `Induct ${name}` });
  await sheet.getByPlaceholder("Why they belong on the wall.").fill("Smoke test inductee");
  await sheet.getByRole("button", { name: "Induct" }).click();
  await expect(page.getByRole("button", { name: /^Hall of Fame · \d{4}$/ })).toBeVisible();

  await page.goto("/history/hall-of-fame");
  await expect(page.getByRole("img", { name: new RegExp(`^${last} jersey`) })).toBeVisible();
  await expect(page.getByText("Smoke test inductee").first()).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.getByRole("link", { name: new RegExp(`${last} jersey`) }).click();
  await page.getByRole("button", { name: /^Hall of Fame · / }).click();
  await page
    .getByRole("dialog", { name: "Hall of Fame plaque" })
    .getByRole("button", { name: "Remove" })
    .click();
  await expect(page.getByRole("button", { name: "Hall of Fame", exact: true })).toBeVisible();
});

test("a report opens the season's recap, told from its games", async ({ page }) => {
  await page.goto(`/history/reports/${SAMPLE_YEAR}`);
  await page.getByRole("link", { name: "Recap" }).click();
  await expect(page.getByRole("heading", { level: 1, name: `${SAMPLE_YEAR} recap` })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Week by week" })).toBeVisible();
  await expect(page.getByText(/in the AFC East/)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Stars" })).toBeVisible();
  await expect(page.getByText(/Veteran Linebacker/)).toBeVisible();
});

test("a real season before the franchise has no recap", async ({ page }) => {
  await page.goto(`/history/recaps/${SAMPLE_YEAR - 1}`);
  await expect(page.getByText(`Nothing to tell for ${SAMPLE_YEAR - 1} yet`)).toBeVisible();
});

test("the induction sheet argues the player's case", async ({ page }) => {
  await page.goto("/roster");
  await page
    .getByRole("link", { name: /Stefon Diggs/ })
    .first()
    .click();
  await page.getByRole("button", { name: "Hall of Fame" }).click();
  await expect(page.getByRole("region", { name: "The case" })).toContainText("with the team");
});

test("the timeline filters by type", async ({ page }) => {
  await page.goto("/history/timeline");
  const types = page.getByRole("radiogroup", { name: "Type" });
  await types.getByRole("radio", { name: /^Games/ }).click();
  await expect(page.getByRole("link", { name: "W 31–17 vs LV" })).toBeVisible();
  await types.getByRole("radio", { name: /^Hall of Fame/ }).click();
  await expect(page.getByRole("link", { name: "W 31–17 vs LV" })).toHaveCount(0);
  await types.getByRole("radio", { name: "All", exact: true }).click();
  await expect(page.getByRole("heading", { name: String(SAMPLE_YEAR) })).toBeVisible();
});

test("the reports archive lists franchise seasons and opens one", async ({ page }) => {
  await page.goto("/history");
  await page.getByRole("link", { name: /Season reports/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Season reports" })).toBeVisible();
  await page.getByRole("link", { name: new RegExp(`^${SAMPLE_YEAR}`) }).click();
  await expect(page.getByRole("heading", { level: 1, name: `${SAMPLE_YEAR} report` })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Season summary" })).toBeVisible();
});

test("a team goal is set, marked by hand, shown on Home, and removed", async ({ page }, testInfo) => {
  const text = `E2E goal ${testInfo.project.name} ${Date.now()}`;
  await page.goto(`/history/reports/${SAMPLE_YEAR}`);
  await page.getByRole("button", { name: "Add goal" }).click();
  const add = page.getByRole("dialog", { name: "Add a goal" });
  await add.getByLabel("Team goal").selectOption({ label: "Write in" });
  await add.getByLabel("Goal", { exact: true }).fill(text);
  await add.getByRole("button", { name: "Add goal" }).click();
  await expect(add).toBeHidden();

  const row = page.getByRole("listitem").filter({ hasText: text });
  await expect(row.getByText("Mark it")).toBeVisible();
  await row.getByRole("button", { name: "Edit goal" }).click();
  const edit = page.getByRole("dialog", { name: "Edit goal" });
  await edit.getByRole("radio", { name: "Hit" }).click();
  await edit.getByRole("button", { name: "Save" }).click();
  await expect(row.getByText("Goal hit · by hand")).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.goto("/");
  const onHome = page.getByRole("listitem").filter({ hasText: text });
  await expect(onHome.getByText(/Goal hit/)).toBeVisible({ timeout: 20_000 });
  await expectNoHorizontalOverflow(page);

  await page.goto(`/history/reports/${SAMPLE_YEAR}`);
  await row.getByRole("button", { name: "Edit goal" }).click();
  await page.getByRole("dialog", { name: "Edit goal" }).getByRole("button", { name: "Remove" }).click();
  await expect(row).toHaveCount(0);
});

test("a player stat goal reads his season totals and shows on Stats", async ({ page }) => {
  // A new target each run: the backend keeps earlier runs' goals, and the title finds this one.
  const target = 1000 + (Date.now() % 400);
  const title = `Passing yards ≥ ${target.toLocaleString("en-US")}`;
  await page.goto(`/history/reports/${SAMPLE_YEAR}`);
  await page.getByRole("button", { name: "Add goal" }).click();
  const add = page.getByRole("dialog", { name: "Add a goal" });
  await add.getByRole("radio", { name: "Player" }).click();
  await add.getByLabel("Player", { exact: true }).selectOption({ label: "Drake Maye" });
  await add.getByLabel("Stat").selectOption({ label: "Passing yards" });
  await add.getByLabel("Target").fill(String(target));
  await add.getByRole("button", { name: "Add goal" }).click();
  await expect(add).toBeHidden();

  // The sample box scores give Maye 1,403 regular-season passing yards.
  const row = page.getByRole("listitem").filter({ hasText: title });
  await expect(row.getByText("Goal hit")).toBeVisible();

  await page.goto("/stats");
  await page.getByRole("radio", { name: "Season", exact: true }).click();
  const panel = page.locator("section").filter({ has: page.getByRole("heading", { name: "Player goals" }) });
  await expect(panel.getByRole("listitem").filter({ hasText: title }).getByText("Goal hit")).toBeVisible({
    timeout: 20_000,
  });
  await expectNoHorizontalOverflow(page);

  await page.goto(`/history/reports/${SAMPLE_YEAR}`);
  await row.getByRole("button", { name: "Edit goal" }).click();
  await page.getByRole("dialog", { name: "Edit goal" }).getByRole("button", { name: "Remove" }).click();
  await expect(row).toHaveCount(0);
});
