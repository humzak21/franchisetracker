import { expect, expectNoHorizontalOverflow, signInAsTestOwner, test } from "./fixtures";

test.describe("signed out", () => {
  test.use({ signedIn: false });

  test("shows only the sign-in screen, on every route", async ({ page }) => {
    for (const path of ["/", "/schedule", "/settings", "/dev/components"]) {
      await page.goto(path);
      await expect(page.getByRole("button", { name: "Sign in with Vercel" })).toBeVisible();
      await expect(page.getByRole("navigation", { name: "Main" })).toHaveCount(0);
      await expect(page.getByText("Patriots Dynasty")).toHaveCount(0);
    }
    await expectNoHorizontalOverflow(page);
  });

  test("Sign in with Vercel leaves for vercel.com with PKCE", async ({ page }) => {
    await page.goto("/");
    const request = page.waitForRequest((req) => req.url().startsWith("https://vercel.com/oauth/authorize"));
    // Abort instead of loading Vercel: the test only checks the outgoing request. The aborted
    // navigation logs a network error, which is expected here, so stop collecting errors.
    page.removeAllListeners("console");
    await page.route("https://vercel.com/**", (route) => route.abort());
    await page.getByRole("button", { name: "Sign in with Vercel" }).click();
    const url = new URL((await request).url());
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("redirect_uri")).toMatch(/\/api\/auth\/callback\/vercel$/);
    expect(url.searchParams.get("scope")).toContain("openid");
  });
});

test("signing out returns to the sign-in screen", async ({ page }) => {
  await page.goto("/settings");
  await expect(page.getByText("test-owner@franchisetracker.local")).toBeVisible();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByRole("button", { name: "Sign in with Vercel" })).toBeVisible();
  await signInAsTestOwner(page);
});
