import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";

/**
 * One specimen on its own (`?only=`), mounted at once. The full page mounts specimens as they
 * scroll into view, four frames each; on CI WebKit the neighbours mounting moved controls under
 * clicks and timed tests out.
 */
async function openSpecimen(page: Page, id: string) {
  await page.goto(`/dev/components?only=${id}`);
  await expect(page.getByRole("heading", { level: 1, name: "Component gallery" })).toBeVisible({
    timeout: 20_000,
  });
  return page.locator(`#${id}`);
}

test.describe("component gallery", () => {
  test("DataTable switches to phone mode inside the phone frame", async ({ page }) => {
    const section = await openSpecimen(page, "datatable");
    const phoneFrame = section.locator("figure").filter({ hasText: /Phone · 390px · dark/ });
    const desktopFrame = section.locator("figure").filter({ hasText: /Desktop · 960px · dark/ });

    await expect(phoneFrame.getByRole("button", { name: "Sort & columns" })).toBeVisible();
    await expect(desktopFrame.getByRole("button", { name: "Columns" })).toBeVisible();
    await expect(desktopFrame.getByRole("columnheader", { name: /100\+/ })).toBeVisible();
    await expect(phoneFrame.getByRole("columnheader", { name: /100\+/ })).toHaveCount(0);

    const diggs = phoneFrame.getByRole("row").filter({ hasText: "Stefon Diggs" });
    await diggs.click();
    await expect(diggs).toHaveAttribute("aria-expanded", "true");
    await expect(phoneFrame.getByText("100-yard games")).toBeVisible();
  });

  test("a long DataTable renders only the rows in view", async ({ page }) => {
    const section = await openSpecimen(page, "datatable-long");
    const frame = section.locator("figure").first();
    const scroller = frame.locator("[data-swipe-ignore] [data-swipe-ignore]").first();
    await expect(frame.getByRole("row", { name: /^Row 1\b/ })).toBeVisible();
    expect(await frame.locator("tbody tr").count()).toBeLessThan(100);
    // Rows are measured as they render, so the bottom moves; keep scrolling until the last row shows.
    await expect(async () => {
      await scroller.evaluate((el) => el.scrollTo({ top: el.scrollHeight }));
      await expect(frame.getByRole("row", { name: /^Row 400\b/ })).toBeVisible({ timeout: 500 });
    }).toPass();
  });

  test("TeamPicker selects one team at a time", async ({ page }) => {
    const frame = (await openSpecimen(page, "teampicker")).locator("figure").first();
    const lions = frame.getByRole("radio", { name: "Detroit Lions" });
    await lions.click();
    await expect(lions).toHaveAttribute("aria-checked", "true");
    await expect(frame.getByRole("radio", { checked: true })).toHaveCount(1);
  });

  test("every specimen renders in both themes", async ({ page }) => {
    await page.goto("/dev/components");
    // The whole gallery: each specimen mounts as it is scrolled to; the first ones are in view.
    await expect(page.getByRole("heading", { level: 1, name: "Component gallery" })).toBeVisible({
      timeout: 20_000,
    });
    const sections = page.locator("section[id]");
    expect(await sections.count()).toBeGreaterThanOrEqual(12);
    for (const theme of ["dark", "light"]) {
      await expect(page.getByText(`Phone · 390px · ${theme}`).first()).toBeVisible();
      await expect(page.getByText(`Desktop · 960px · ${theme}`).first()).toBeAttached();
    }
  });

  test("a specimen link opens just that specimen", async ({ page }) => {
    await openSpecimen(page, "teampicker");
    await expect(page.locator("section[id]")).toHaveCount(1);
  });
});
