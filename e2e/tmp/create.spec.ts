import { expect, test } from "../fixtures";
test("submit the new franchise form", async ({ page }) => {
  page.on("console", (m) => console.log("CONSOLE", m.type(), m.text().slice(0, 200)));
  await page.goto("/franchises/new");
  await expect(page.getByRole("heading", { level: 1, name: "New franchise" })).toBeVisible();
  await page.getByPlaceholder("e.g. Foxborough Dynasty").fill("Probe Franchise");
  await page.getByRole("radio", { name: /Detroit Lions/ }).click();
  await page.getByRole("button", { name: "Create franchise" }).click();
  await expect(page.getByRole("heading", { name: "Probe Franchise" })).toBeVisible({ timeout: 20_000 });
});
