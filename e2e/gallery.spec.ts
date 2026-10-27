import { expect, test } from "./fixtures";

test.describe("component gallery", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dev/components");
    // Each specimen renders four times (two themes, two widths) as it is scrolled to: slow on CI WebKit.
    await expect(page.getByRole("heading", { level: 1, name: "Component gallery" })).toBeVisible({
      timeout: 20_000,
    });
  });

  test("DataTable switches to phone mode inside the phone frame", async ({ page }) => {
    const section = page.locator("#datatable");
    // Specimens mount when scrolled to.
    await section.scrollIntoViewIfNeeded();
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
    const section = page.locator("#datatable-long");
    await section.scrollIntoViewIfNeeded();
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
    // Specimens mount when scrolled to.
    await page.locator("#teampicker").scrollIntoViewIfNeeded();
    const frame = page.locator("#teampicker figure").first();
    const lions = frame.getByRole("radio", { name: "Detroit Lions" });
    await lions.click();
    await expect(lions).toHaveAttribute("aria-checked", "true");
    await expect(frame.getByRole("radio", { checked: true })).toHaveCount(1);
  });

  test("every specimen renders in both themes", async ({ page }) => {
    const sections = page.locator("section[id]");
    expect(await sections.count()).toBeGreaterThanOrEqual(12);
    for (const theme of ["dark", "light"]) {
      await expect(page.getByText(`Phone · 390px · ${theme}`).first()).toBeVisible();
      await expect(page.getByText(`Desktop · 960px · ${theme}`).first()).toBeAttached();
    }
  });
});
