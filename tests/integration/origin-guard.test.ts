import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SAME_ORIGIN_HEADERS, TEST_ORIGIN } from "../support/origin";

import { testDb } from "./support/db";
import { aCourseWithTopic, aUserRow } from "./support/fixtures";

const clerkAuth = vi.hoisted(() => vi.fn());
vi.mock("@clerk/nextjs/server", () => ({ auth: clerkAuth, currentUser: vi.fn() }));
vi.mock("@/lib/db", async () => {
  const { testDb: get } = await import("./support/db");
  return {
    get db() {
      return get();
    },
  };
});

// The Course routes build a Mux client at import time. No test here may reach
// Mux, so the client is a double with no network behind it.
vi.mock("@mux/mux-node", () => {
  class Mux {
    video = { assets: { create: vi.fn(), delete: vi.fn() } };
  }
  return { default: Mux, Mux };
});

const { POST: createJournal } = await import("@/app/api/journal/route");
const { POST: createCourse } = await import("@/app/api/courses/route");
const { DELETE: deleteCourse } = await import("@/app/api/courses/[courseId]/route");
const { PATCH: patchSettings } = await import("@/app/api/settings/route");
const { POST: stripeWebhook } = await import("@/app/api/webhook/route");
const { POST: clerkWebhook } = await import("@/app/api/webhooks/clerk/route");
const { POST: uploadThing } = await import("@/app/api/uploadthing/route");

/**
 * Cross-site request forgery against real route handlers and a real database
 * (#45).
 *
 * The session is mocked as present for every request, which is exactly the
 * CSRF threat model: the victim's browser attaches their Clerk cookie to a
 * request a hostile page started. Each refusal is checked twice -- by the
 * response, and by the database, so "403 but the row was written anyway" cannot
 * pass.
 */
const EVIL = "https://evil.example";

function journalRequest(headers: Record<string, string>) {
  return new Request(`${TEST_ORIGIN}/api/journal`, {
    method: "POST",
    body: JSON.stringify({ title: "Reflection", content: "<p>private</p>" }),
    headers: { "content-type": "application/json", ...headers },
  });
}

async function codeOf(response: Response): Promise<string> {
  return (await response.json()).error.code;
}

describe("origin guard on cookie-authenticated mutations", () => {
  let learner: { id: string };

  beforeEach(async () => {
    learner = await aUserRow();
    clerkAuth.mockResolvedValue({ userId: learner.id });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("accepts a same-origin request and writes", async () => {
    const response = await createJournal(journalRequest(SAME_ORIGIN_HEADERS));

    expect(response.status).toBe(200);
    expect(await testDb().journalEntry.count({ where: { userId: learner.id } })).toBe(1);
  });

  describe("refuses, and writes nothing, for", () => {
    it.each([
      ["a cross-site page", { origin: EVIL, "sec-fetch-site": "cross-site" }],
      // A hostile page cannot set Sec-Fetch-Site; an older browser omits it.
      // Origin alone must still refuse.
      ["a cross-site Origin without Fetch Metadata", { origin: EVIL }],
      ["a sibling subdomain", { origin: "http://forum.localhost:3000", "sec-fetch-site": "same-site" }],
      ["a null Origin", { origin: "null" }],
      ["a missing Origin", {}],
      ["a protocol-relative Origin", { origin: "//evil.example" }],
      ["the trusted host as a prefix", { origin: "http://localhost:3000.evil.example" }],
      ["the trusted host on another port", { origin: "http://localhost:3001" }],
      // Proxy host handling: forwarded headers do not feed the allow-list.
      ["a spoofed X-Forwarded-Host", { origin: EVIL, "x-forwarded-host": "evil.example", "x-forwarded-proto": "https" }],
    ])("%s", async (_label, headers) => {
      const response = await createJournal(journalRequest(headers));

      expect(response.status).toBe(403);
      expect(await codeOf(response)).toBe("untrusted_origin");
      expect(response.headers.get("access-control-allow-origin")).toBeNull();
      expect(await testDb().journalEntry.count()).toBe(0);
    });
  });

  it("refuses before resolving the principal, so a refusal reveals nothing", async () => {
    clerkAuth.mockResolvedValue({ userId: null });
    // The integration config does not reset mocks between tests, so earlier
    // calls would otherwise count against this assertion.
    clerkAuth.mockClear();

    const response = await createJournal(journalRequest({ origin: EVIL }));

    // Not 401: an anonymous cross-site probe learns nothing about the session.
    expect(response.status).toBe(403);
    expect(await codeOf(response)).toBe("untrusted_origin");
    expect(clerkAuth).not.toHaveBeenCalled();
  });

  it("refuses before reading the body", async () => {
    const request = new Request(`${TEST_ORIGIN}/api/journal`, {
      method: "POST",
      body: "{ not json",
      headers: { "content-type": "application/json", origin: EVIL },
    });

    // A malformed body would be 400; the guard answers first.
    expect(await codeOf(await createJournal(request))).toBe("untrusted_origin");
  });

  it("protects a privileged action from a forged request riding a faculty session", async () => {
    const author = await aUserRow({ role: "FACULTY" });
    clerkAuth.mockResolvedValue({ userId: author.id });

    const refused = await createCourse(
      new Request(`${TEST_ORIGIN}/api/courses`, {
        method: "POST",
        body: JSON.stringify({ title: "Planted" }),
        headers: { "content-type": "application/json", origin: EVIL },
      })
    );
    expect(refused.status).toBe(403);
    expect(await testDb().course.count()).toBe(0);

    const accepted = await createCourse(
      new Request(`${TEST_ORIGIN}/api/courses`, {
        method: "POST",
        body: JSON.stringify({ title: "Research Ethics" }),
        headers: { "content-type": "application/json", ...SAME_ORIGIN_HEADERS },
      })
    );
    expect(accepted.status).toBe(200);
    expect(await testDb().course.count()).toBe(1);
  });

  it("protects a bodiless DELETE", async () => {
    const author = await aUserRow({ role: "FACULTY" });
    const { course } = await aCourseWithTopic(author.id);
    clerkAuth.mockResolvedValue({ userId: author.id });

    const response = await deleteCourse(
      new Request(`${TEST_ORIGIN}/api/courses/${course.id}`, {
        method: "DELETE",
        headers: { origin: EVIL, "sec-fetch-site": "cross-site" },
      }),
      { params: Promise.resolve({ courseId: course.id }) }
    );

    expect(response.status).toBe(403);
    expect(await testDb().course.findUnique({ where: { id: course.id } })).not.toBeNull();
  });

  it("protects account settings", async () => {
    const response = await patchSettings(
      new Request(`${TEST_ORIGIN}/api/settings`, {
        method: "PATCH",
        body: JSON.stringify({ showProfileInCommunity: true }),
        headers: { "content-type": "application/json", origin: EVIL },
      })
    );

    expect(response.status).toBe(403);
    expect(await codeOf(response)).toBe("untrusted_origin");
    expect(await testDb().userSettings.count()).toBe(0);
  });

  it("honours an additional origin from TRUSTED_ORIGINS", async () => {
    vi.stubEnv("TRUSTED_ORIGINS", "https://staging.akomapa.org");

    const response = await createJournal(
      journalRequest({ origin: "https://staging.akomapa.org", "sec-fetch-site": "same-origin" })
    );

    expect(response.status).toBe(200);
  });

  it("fails closed when the allow-list is misconfigured", async () => {
    vi.stubEnv("TRUSTED_ORIGINS", "https://*.akomapa.org");

    const response = await createJournal(journalRequest(SAME_ORIGIN_HEADERS));

    expect(response.status).toBe(500);
    expect(await testDb().journalEntry.count()).toBe(0);
  });
});

describe("signature-verified webhooks are exempt", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  // Provider servers send no Origin, and a cross-site page has no credential
  // to ride on here -- the signature is the authentication. Reaching the
  // signature check (and failing it) proves the guard did not answer first.
  it("lets a Stripe delivery reach signature verification", async () => {
    const response = await stripeWebhook(
      new Request(`${TEST_ORIGIN}/api/webhook`, {
        method: "POST",
        body: "{}",
        headers: { origin: EVIL, "sec-fetch-site": "cross-site" },
      })
    );

    expect(response.status).toBe(400);
    expect(await codeOf(response)).toBe("invalid_parameter");
  });

  it("refuses a cross-site UploadThing upload request", async () => {
    const response = await uploadThing(
      new NextRequest(`${TEST_ORIGIN}/api/uploadthing?actionType=upload&slug=courseImage`, {
        method: "POST",
        body: JSON.stringify({ files: [] }),
        headers: { "content-type": "application/json", origin: EVIL },
      })
    );

    expect(response.status).toBe(403);
    expect(await codeOf(response)).toBe("untrusted_origin");
  });

  it("refuses an upload request that also claims to be a server hook", async () => {
    const response = await uploadThing(
      new NextRequest(`${TEST_ORIGIN}/api/uploadthing?actionType=upload&slug=courseImage`, {
        method: "POST",
        body: "{}",
        headers: { origin: EVIL, "uploadthing-hook": "callback" },
      })
    );

    expect(await codeOf(response)).toBe("untrusted_origin");
  });

  it("lets an UploadThing server callback through to the library's signature check", async () => {
    // A well-formed placeholder token -- the base64 JSON shape UploadThing
    // parses -- so the library gets as far as verifying the HMAC. It is not a
    // credential and reaches no network.
    vi.stubEnv(
      "UPLOADTHING_TOKEN",
      Buffer.from(
        JSON.stringify({ apiKey: "sk_test_placeholder", appId: "placeholder", regions: ["sea1"] })
      ).toString("base64")
    );

    const response = await uploadThing(
      new NextRequest(`${TEST_ORIGIN}/api/uploadthing?slug=courseImage`, {
        method: "POST",
        body: "{}",
        // UploadThing's servers send no Origin. The forged signature is
        // UploadThing's to refuse, which it does; the guard must not answer.
        headers: {
          "content-type": "application/json",
          "uploadthing-hook": "callback",
          "x-uploadthing-signature": "hmac-sha256=forged",
        },
      })
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ message: "Invalid signature" });
  });

  it("lets a Clerk delivery reach signature verification", async () => {
    const response = await clerkWebhook(
      new Request(`${TEST_ORIGIN}/api/webhooks/clerk`, { method: "POST", body: "{}" })
    );

    expect(response.status).toBe(400);
    expect(await codeOf(response)).toBe("invalid_parameter");
  });
});
