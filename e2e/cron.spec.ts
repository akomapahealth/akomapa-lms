import { expect, test } from "@playwright/test";

/**
 * The scheduled outbox route over HTTP, against the production build (#69).
 *
 * It sits on the proxy's public matcher and authenticates itself, so these
 * prove it is reachable past Clerk and refuses callers there. CI's server has
 * no CRON_SECRET, so the route must fail closed for everyone -- including a
 * caller who guesses a bearer token.
 */
test.skip(Boolean(process.env.CRON_SECRET), "needs a server without CRON_SECRET");

for (const authorization of [undefined, "Bearer guessed-token-of-plausible-length"]) {
  test(`refuses ${authorization ? "a guessed secret" : "an unauthenticated call"} without running`, async ({ request }) => {
    const response = await request.get("/api/cron/outbox", {
      headers: authorization ? { authorization } : {},
    });

    // Past the proxy (not a sign-in redirect or a 404), and refused.
    expect(response.status()).toBe(500);
    const body = await response.json();
    expect(body.error.code).toBe("internal");
    expect(body).not.toHaveProperty("summary");
  });
}
