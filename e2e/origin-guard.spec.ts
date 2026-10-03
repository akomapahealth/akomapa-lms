import { expect, test } from "@playwright/test";

/**
 * Cross-site request protection, over HTTP against the production server (#45).
 *
 * The route-level behaviour is proven in tests/integration/origin-guard.test.ts.
 * These cases need the whole stack: Next.js's own OPTIONS handling, the Clerk
 * proxy in front of the handlers, and real header parsing. They use only routes
 * that sit on the proxy's public matcher, so no session is needed -- a CSRF
 * attack does not need one to be refused.
 *
 * The trusted origin is whatever the server was started with; CI sets
 * NEXT_PUBLIC_APP_URL to http://localhost:3000.
 */
const TRUSTED = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const EVIL = "https://evil.example";

// An upload-slot request: the browser half of UploadThing, cookie-authenticated
// and therefore guarded.
const UPLOAD = "/api/uploadthing?actionType=upload&slug=courseImage";

test.describe("preflight", () => {
  for (const path of ["/api/webhook", UPLOAD, "/api/journal"]) {
    test(`never approves a cross-origin preflight for ${path}`, async ({ request }) => {
      const response = await request.fetch(path, {
        method: "OPTIONS",
        headers: {
          origin: EVIL,
          "access-control-request-method": "POST",
          "access-control-request-headers": "content-type",
        },
      });

      // Without Access-Control-Allow-Origin the browser refuses to send the
      // real request, so a cross-site page cannot make a JSON mutation at all.
      // The guard is what stops the requests that need no preflight.
      expect(response.headers()["access-control-allow-origin"]).toBeUndefined();
      expect(response.headers()["access-control-allow-credentials"]).toBeUndefined();
    });
  }
});

test.describe("guarded mutation", () => {
  test("refuses a cross-site form post", async ({ request }) => {
    // A form post needs no preflight: this is the request CSRF actually uses.
    const response = await request.post(UPLOAD, {
      headers: {
        origin: EVIL,
        "sec-fetch-site": "cross-site",
        "content-type": "application/x-www-form-urlencoded",
      },
      data: "files=x",
    });

    expect(response.status()).toBe(403);
    expect((await response.json()).error.code).toBe("untrusted_origin");
  });

  test("refuses a request with no Origin", async ({ request }) => {
    const response = await request.post(UPLOAD, { data: { files: [] } });

    expect(response.status()).toBe(403);
    expect((await response.json()).error.code).toBe("untrusted_origin");
  });

  test("ignores a spoofed X-Forwarded-Host", async ({ request }) => {
    const response = await request.post(UPLOAD, {
      headers: { origin: EVIL, "x-forwarded-host": "evil.example", "x-forwarded-proto": "https" },
      data: { files: [] },
    });

    expect(response.status()).toBe(403);
    expect((await response.json()).error.code).toBe("untrusted_origin");
  });

  test("lets a same-origin request past the guard", async ({ request }) => {
    const response = await request.post(UPLOAD, {
      headers: { origin: TRUSTED, "sec-fetch-site": "same-origin" },
      data: { files: [] },
    });

    // UploadThing then refuses for its own reasons -- no session, and a
    // placeholder token in CI -- but not as a cross-site request.
    expect(response.status()).not.toBe(200);
    const body = await response.text();
    expect(body).not.toContain("untrusted_origin");
  });
});

test.describe("signature-verified webhooks", () => {
  test("Stripe deliveries reach signature verification", async ({ request }) => {
    const response = await request.post("/api/webhook", {
      headers: { origin: EVIL },
      data: "{}",
    });

    expect(response.status()).toBe(400);
    expect((await response.json()).error.code).toBe("invalid_parameter");
  });

  test("Clerk deliveries reach signature verification", async ({ request }) => {
    const response = await request.post("/api/webhooks/clerk", { data: "{}" });

    expect(response.status()).toBe(400);
    expect((await response.json()).error.code).toBe("invalid_parameter");
  });
});
