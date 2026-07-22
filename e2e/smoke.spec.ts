import { expect, test } from "@playwright/test";

/**
 * Public smoke tests — no auth, no DB writes. Purpose is to catch deploys that
 * fail to boot or render the public shell, not to test product behavior.
 */

test("marketing homepage renders", async ({ page }) => {
  const response = await page.goto("/");
  expect(response, "homepage should return a response").not.toBeNull();
  expect(response!.status(), "homepage should not error").toBeLessThan(400);

  await expect(page).toHaveTitle(/Akomapa/i);
  await expect(page.locator("h1").first()).toBeVisible();
});

test("sign-in page is reachable", async ({ page }) => {
  const response = await page.goto("/sign-in");
  expect(response, "sign-in should return a response").not.toBeNull();
  expect(response!.status(), "sign-in should not error").toBeLessThan(400);
  await expect(page).toHaveURL(/sign-in/);
});

test("security headers are present", async ({ page }) => {
  const response = await page.goto("/");
  const headers = response!.headers();
  expect(headers["x-frame-options"]).toBe("DENY");
  expect(headers["x-content-type-options"]).toBe("nosniff");
});
