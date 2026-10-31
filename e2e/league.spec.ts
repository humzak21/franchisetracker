import type { Page } from "@playwright/test";
import { expect, expectNoHorizontalOverflow, SAMPLE_YEAR, test } from "./fixtures";

// Every project shares one backend: tests add and remove their own rows, named per project.

const SCREENS = ["/league", "/league/teams/buf", "/awards", "/draft", "/transactions"];

/** Remembers a season for one screen, the way the season switcher does, then opens it. */
async function openWithSeason(page: Page, path: string, section: string, year: number) {
  await page.goto(path);
  // Reloading while the route's code is still loading aborts it, and WebKit logs that as an error.
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.locator("[aria-busy=true]")).toHaveCount(0, { timeout: 20_000 });
  await page.evaluate(
    ([s, y]) => {
      const key = "ft.season-by-screen";
      const map = JSON.parse(localStorage.getItem(key) ?? "{}") as Record<string, number>;
      localStorage.setItem(key, JSON.stringify({ ...map, [s as string]: y }));
    },
    [section, year] as const,
  );
  await page.reload();
}

for (const theme of ["dark", "light"] as const) {
  test.describe(`${theme} theme`, () => {
    test.use({ theme });
    test("league, awards, draft and transactions load without overflow", async ({ page }) => {
      for (const path of SCREENS) {
        await page.goto(path);
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        await expect(page.locator("[aria-busy=true]")).toHaveCount(0, { timeout: 20_000 });
        await expectNoHorizontalOverflow(page);
      }
    });
  });
}

test("the league answers who won the AFC, and rebuilds the bracket", async ({ page }) => {
  await page.goto("/league");
  await page.getByRole("radio", { name: "Champions", exact: true }).click();
  const year = page.getByRole("row").filter({ hasText: "2025" });
  // The sample's real 2025 season: New England won the AFC, Seattle the NFC and the Super Bowl.
  await expect(year.getByRole("link", { name: /New England Patriots/ })).toBeVisible();
  await expect(year.getByRole("link", { name: /Seattle Seahawks/ })).toHaveCount(2);

  // Standings, scores and the bracket share one page; a finished season's bracket is the real one.
  await openWithSeason(page, "/league", "league", 2025);
  await page.getByRole("radio", { name: "Season", exact: true }).click();
  await expect(page.getByRole("region", { name: "Wild Card" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Super Bowl" })).toBeVisible();
  await expect(page.getByText("Projected")).toHaveCount(0);
  await expect(
    page
      .getByRole("region", { name: "AFC East" })
      .getByTitle(/^Clinched/)
      .first(),
  ).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.getByRole("radio", { name: "Conference", exact: true }).click();
  await expect(page.getByRole("region", { name: "AFC", exact: true }).getByRole("listitem")).toHaveCount(16);
  await page.getByRole("radio", { name: "Divisions", exact: true }).click();
  await page.getByRole("region", { name: "AFC East" }).getByRole("link", { name: /Bills/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Buffalo Bills" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Head to head" })).toBeVisible();
});

test("a season being played projects the bracket and offers the real schedule", async ({ page }) => {
  await openWithSeason(page, "/league", "league", 2026);
  await page.getByRole("radio", { name: "Season", exact: true }).click();
  await expect(page.getByRole("region", { name: "AFC East" }).getByRole("listitem")).toHaveCount(4);
  await expect(page.getByText("Projected")).toBeVisible();
  await expect(page.getByRole("region", { name: "Wild Card" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Load NFL schedule" })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test("weekly awards, and a team award given and taken back", async ({ page }, info) => {
  await page.goto("/awards");
  await page.getByRole("radio", { name: /^Weekly/ }).click();
  await expect(page.getByText("Christian Gonzalez").first()).toBeVisible();
  await page.getByRole("radio", { name: /^Team/ }).click();
  await page.getByRole("button", { name: "Give a team award" }).click();
  const sheet = page.getByRole("dialog", { name: "Give a team award" });
  const name = `E2E ${info.project.name} award`;
  await sheet.getByLabel("Award", { exact: true }).fill(name);
  await sheet.getByLabel("Player").selectOption({ label: "Drake Maye · QB" });
  await sheet.getByRole("button", { name: "Give award" }).click();
  await expect(page.getByText(name)).toBeVisible();
  await page.getByRole("button", { name: `Remove ${name}` }).click();
  await expect(page.getByText(name)).toHaveCount(0);
});

// Projects share one backend, so each overrides its own award and leaves the others' counts alone.
const COUNTED: Record<string, [award: string, leader: string]> = {
  desktop: ["Ball Hawk", "Sauce Gardner"],
  phone: ["Sack Leader", "Zach Sieler"],
  "phone-large": ["Heat Seeker", "Terrel Bernard"],
};

test("season awards counted from the stats, overridden by hand and back", async ({ page }, info) => {
  const [award, leader] = COUNTED[info.project.name] ?? COUNTED.desktop!;
  await page.goto("/awards");
  await page.getByRole("radio", { name: /^Season/ }).click();
  const slot = page.getByRole("listitem").filter({ hasText: award });
  await expect(slot.getByText(leader)).toBeVisible();

  await slot.getByRole("button", { name: `${award} actions` }).click();
  await page.getByRole("button", { name: "Assign winner" }).click();
  const sheet = page.getByRole("dialog", { name: `Assign ${award}` });
  await sheet.getByLabel("Search players").fill("Christian Gon");
  await sheet
    .getByRole("list", { name: "Search results" })
    .getByRole("button", { name: /Christian Gonzalez/ })
    .click();
  await expect(slot.getByText("Christian Gonzalez")).toBeVisible();
  await expect(slot.getByText(leader)).toHaveCount(0);

  await slot.getByRole("button", { name: `${award} actions` }).click();
  await page.getByRole("button", { name: "Back to the count" }).click();
  await expect(slot.getByText(leader)).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test("the draft: a graded class, the pick inventory and the board", async ({ page }, info) => {
  await openWithSeason(page, "/draft", "draft", 2024);
  await page.getByRole("radio", { name: "Draft", exact: true }).click();
  await expect(page.getByText("Drake Maye")).toBeVisible();
  await expect(page.getByText("Class grade")).toBeVisible();

  await page.getByRole("radio", { name: "Picks", exact: true }).click();
  await expect(page.getByText("+ BUF").first()).toBeVisible();
  await expect(page.getByText("to MIA").first()).toBeVisible();

  await page.getByRole("radio", { name: "Board", exact: true }).click();
  const prospect = `E2E ${info.project.name} prospect`;
  await page.getByLabel("Prospect", { exact: true }).fill(prospect);
  await page.getByRole("button", { name: "Add" }).click();
  await expect(page.getByText(prospect)).toBeVisible();
  await page.getByRole("button", { name: `Remove ${prospect}` }).click();
  await expect(page.getByText(prospect)).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
});

test("transactions: the feed by type, the trade tracker, injuries and the cap", async ({ page }) => {
  await page.goto("/transactions");
  await page.getByRole("radio", { name: /^Moves/ }).click();
  await page
    .getByRole("radiogroup", { name: "Type" })
    .getByRole("radio", { name: /^Trade/ })
    .click();
  await expect(page.getByText("Veteran Linebacker")).toBeVisible();
  await expect(page.getByText("Stefon Diggs")).toHaveCount(0);

  await page.getByRole("radio", { name: /^Trades/ }).click();
  const note = page.getByLabel("In hindsight");
  await note.fill(`Depth that held up, ${Date.now()}`);
  await note.blur();
  await expect(page.getByText("Saved")).toBeVisible();

  await page.getByRole("radio", { name: /^Injuries/ }).click();
  await expect(page.getByText("High ankle sprain · 2-4 weeks")).toBeVisible();

  await page.getByRole("radio", { name: "Cap", exact: true }).click();
  await expect(page.getByText("$55.1M")).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test("the contract year: who expires, next season, and a re-signing sheet", async ({ page }) => {
  await page.goto("/transactions");
  await page.getByRole("radio", { name: "Cap", exact: true }).click();
  await expect(page.getByRole("heading", { name: `Going into ${SAMPLE_YEAR + 1}` })).toBeVisible();
  await expect(page.getByText("$42.7M")).toBeVisible();
  const expiring = page.getByRole("listitem").filter({ hasText: "Hunter Henry" });
  await expiring.getByRole("button", { name: "Re-sign" }).click();
  await expect(page.getByRole("dialog").getByText("Hunter Henry")).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test("a rival opens its rivalry page, without overflow", async ({ page }) => {
  await page.goto("/league");
  await page.getByRole("radio", { name: "Rivals" }).click();
  await page.getByRole("link", { name: "Steelers" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "vs Steelers" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "What stands out" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Our best against them" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Every meeting" })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.getByRole("link", { name: "Team page" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Pittsburgh Steelers" })).toBeVisible();
});

test("a player's awards and moves are on their page, and injuries on the roster", async ({ page }) => {
  await page.goto("/roster");
  await expect(page.getByText("High ankle sprain · 2-4 weeks").first()).toBeVisible({ timeout: 20_000 });
  await page
    .getByRole("link", { name: /Drake Maye/ })
    .first()
    .click();
  await expect(page.getByRole("heading", { name: "Awards and moves" })).toBeVisible();
  // Other tests commit weekly awards to the same backend, so he may have won it more than once.
  await expect(page.getByText("Offensive Player of the Week").first()).toBeVisible();
});
