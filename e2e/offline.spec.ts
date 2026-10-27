import { expect, gotoHome, isPhone, test } from "./fixtures";

test("screens seen before still read offline, with a banner saying so", async ({ page, context }, info) => {
  await gotoHome(page);
  // Visit the schedule once so its data is cached, then come back home.
  const nav = (name: string) =>
    isPhone(info.project.name)
      ? page.getByRole("navigation", { name: "Main" }).getByRole("link", { name, exact: true }).last()
      : page.getByRole("navigation", { name: "Main" }).getByRole("link", { name, exact: true }).first();
  await nav("Schedule").click();
  await expect(page.getByText("Raiders").first()).toBeVisible();
  await nav("Home").click();
  await expect(page.getByRole("heading", { level: 1, name: "Home" })).toBeVisible();

  // Offline, the Convex socket logs connection errors on purpose; they are not the app's.
  page.removeAllListeners("console");
  await context.setOffline(true);
  await expect(page.getByRole("status").filter({ hasText: "Offline" })).toBeVisible();

  await nav("Schedule").click();
  await expect(page.getByRole("heading", { level: 1, name: "Schedule" })).toBeVisible();
  await expect(page.getByText("Raiders").first()).toBeVisible();

  await context.setOffline(false);
  await expect(page.getByRole("status").filter({ hasText: "Offline" })).toHaveCount(0);
});
