import { NAV_ITEMS } from "../src/app/nav";
import { expect, gotoHome, isPhone, test } from "./fixtures";

// Screens reached from the nav, plus the drill-downs the sample has data for.
const SCREENS = [
  ...NAV_ITEMS.map((n) => n.to),
  "/league/teams/buf",
  "/players/compare",
  "/history/timeline",
  "/history/hall-of-fame",
  "/history/reports",
  "/stats/reconcile",
  "/franchises/new",
];

/**
 * Touch targets (FEATURES.md 9): on a phone every link, button and field is at least 44 px each
 * way, counting a `touch-target` hit area. Links inside running text are exempt, as WCAG allows.
 */
test("every control on every screen is big enough to tap", async ({ page }, info) => {
  test.skip(!isPhone(info.project.name), "touch screens only");
  test.setTimeout(120_000);
  const small: string[] = [];
  for (const path of SCREENS) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.locator("[aria-busy=true]")).toHaveCount(0, { timeout: 20_000 });
    const found = await page.evaluate(() =>
      [
        ...document.querySelectorAll<HTMLElement>(
          "a[href], button, input:not([type=hidden]), select, textarea, [role=button], [role=radio], [role=tab], [role=checkbox], [role=switch], summary",
        ),
      ].flatMap((el) => {
        const box = el.getBoundingClientRect();
        // Hidden, or visually hidden behind a visible control (a file input behind its button).
        if (box.width <= 1 || box.height <= 1 || el.closest("[aria-hidden=true]")) return [];
        // Half a pixel of slack: layout lands on fractional pixels (43.99 is 44 on screen).
        if (box.width >= 43.5 && box.height >= 43.5) return [];
        const after = getComputedStyle(el, "::after");
        if (after.content !== "none" && parseFloat(after.width) >= 44 && parseFloat(after.height) >= 44)
          return [];
        if (el.tagName === "A" && el.closest("p")) return [];
        const name = (el.getAttribute("aria-label") ?? el.textContent ?? el.tagName).trim().slice(0, 40);
        return [`${Math.round(box.width)}x${Math.round(box.height)} ${el.tagName.toLowerCase()} "${name}"`];
      }),
    );
    small.push(...found.map((f) => `${path}: ${f}`));
  }
  expect(small).toEqual([]);
});

test.describe("reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("transitions and animations are switched off", async ({ page }) => {
    await gotoHome(page);
    const durations = await page.evaluate(() => {
      const el = document.querySelector("a[href]") as HTMLElement;
      const style = getComputedStyle(el);
      return [style.transitionDuration, style.animationDuration];
    });
    for (const d of durations) expect(parseFloat(d)).toBeLessThanOrEqual(0.0001);
  });
});
