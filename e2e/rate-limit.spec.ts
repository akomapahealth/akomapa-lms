import { expect, test } from "@playwright/test";

/**
 * Rate-limit failure behaviour, over HTTP against the production build (#46).
 *
 * CI's E2E job runs the server with a placeholder DATABASE_URL, so the
 * rate-limit store is unreachable -- the provider-degraded state, for real.
 * These cases prove what each kind of policy does then: an expensive operation
 * fails closed with 503 and Retry-After, and a provider webhook fails open so
 * no event is lost. Limits engaging against a working store are proven in
 * tests/integration/rate-limit-*.test.ts.
 *
 * Run only where the store is known to be unreachable (CI sets
 * E2E_RATE_LIMIT_STORE=unreachable); against a working database the upload
 * request would correctly proceed and these assertions would not apply.
 */
test.skip(
  process.env.E2E_RATE_LIMIT_STORE !== "unreachable",
  "needs a server whose rate-limit store is unreachable"
);

const TRUSTED = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

test("an expensive operation fails closed with 503 and Retry-After", async ({ request }) => {
  const response = await request.post("/api/uploadthing?actionType=upload&slug=courseImage", {
    headers: { origin: TRUSTED, "sec-fetch-site": "same-origin" },
    data: { files: [] },
  });

  expect(response.status()).toBe(503);
  expect(response.headers()["retry-after"]).toBe("30");
  const body = await response.json();
  expect(body.error.code).toBe("temporarily_unavailable");
  // UploadThing's client shows only a top-level message.
  expect(body.message).toBe(body.error.message);
});

test("a provider webhook fails open and still reaches signature checks", async ({ request }) => {
  const response = await request.post("/api/webhook", { data: "{}" });

  // 400 for the missing signature: the limiter let it through.
  expect(response.status()).toBe(400);
  expect((await response.json()).error.code).toBe("invalid_parameter");
});
