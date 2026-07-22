import { expect, test } from "@playwright/test";

/**
 * Public smoke tests — no auth, no DB writes. Purpose is to catch deploys that
 * fail to boot or render the public shell, not to test product behavior.
 *
 * These use Playwright's Node-based `request` client rather than a browser: the
 * assertions are all HTTP-level (status, final URL, headers, server-rendered
 * HTML), and a real browser adds CI networking fragility (Chromium can report
 * net::ERR_NAME_NOT_RESOLVED against loopback) without adding coverage here.
 */

test("marketing homepage renders", async ({ request }) => {
  const response = await request.get("/");
  expect(response.status(), "homepage should not error").toBeLessThan(400);

  const html = await response.text();
  const title = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] ?? "";
  expect(title, "homepage <title> should mention Akomapa").toMatch(/Akomapa/i);
  expect(html, "homepage should render an <h1>").toMatch(/<h1[\s>]/i);
});

test("sign-in page is reachable", async ({ request }) => {
  const response = await request.get("/sign-in");
  expect(response.status(), "sign-in should not error").toBeLessThan(400);
  expect(response.url(), "sign-in should resolve to the sign-in route").toMatch(
    /sign-in/,
  );
});

test("security headers are present", async ({ request }) => {
  const response = await request.get("/");
  const headers = response.headers();
  expect(headers["x-frame-options"]).toBe("DENY");
  expect(headers["x-content-type-options"]).toBe("nosniff");
});
