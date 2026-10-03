import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  assertTrustedOrigin,
  enforceTrustedOrigin,
  evaluateOrigin,
  isUploadThingServerCallback,
  parseConfiguredOrigin,
  parseVercelHost,
  resolveTrustedOrigins,
} from "@/lib/http/origin";
import { ApiError } from "@/lib/http/problem";

const logError = vi.hoisted(() => vi.fn());
const logWarn = vi.hoisted(() => vi.fn());
vi.mock("@/lib/logger", () => ({ logError, logWarn }));

const APP = "https://academy.akomapa.org";
const TRUSTED = new Set([APP, "http://localhost:3000"]);

function headers(values: Record<string, string>): Headers {
  return new Headers(values);
}

/** What a current browser sends on a same-origin `fetch` POST from the app. */
const SAME_ORIGIN = { origin: APP, "sec-fetch-site": "same-origin" };

beforeEach(() => {
  logError.mockClear();
  logWarn.mockClear();
});

describe("parseConfiguredOrigin", () => {
  it.each([
    ["https://academy.akomapa.org", "https://academy.akomapa.org"],
    // A trailing slash is how most people write a URL; it names the same origin.
    ["https://academy.akomapa.org/", "https://academy.akomapa.org"],
    ["  https://academy.akomapa.org  ", "https://academy.akomapa.org"],
    // Normalised to the browser's serialization, so the set lookup is exact.
    ["HTTPS://Academy.Akomapa.ORG", "https://academy.akomapa.org"],
    ["https://academy.akomapa.org:443", "https://academy.akomapa.org"],
    ["https://staging.akomapa.org:8443", "https://staging.akomapa.org:8443"],
    ["http://localhost:3000", "http://localhost:3000"],
    ["http://127.0.0.1:3000", "http://127.0.0.1:3000"],
    ["http://[::1]:3000", "http://[::1]:3000"],
  ])("accepts %s as %s", (value, origin) => {
    expect(parseConfiguredOrigin(value)).toBe(origin);
  });

  it.each([
    ["an empty string", ""],
    ["whitespace", "   "],
    ["a wildcard host", "https://*.akomapa.org"],
    ["a bare wildcard", "*"],
    ["a bare hostname", "academy.akomapa.org"],
    ["a protocol-relative value", "//academy.akomapa.org"],
    ["a path", "https://academy.akomapa.org/app"],
    ["a query", "https://academy.akomapa.org/?x=1"],
    ["a fragment", "https://academy.akomapa.org/#top"],
    ["credentials", "https://user:pass@academy.akomapa.org"],
    ["a username alone", "https://user@academy.akomapa.org"],
    ["a non-HTTP scheme", "ftp://academy.akomapa.org"],
    ["a javascript: URL", "javascript:alert(1)"],
    // A production origin over a downgradeable transport is not trusted.
    ["plain HTTP off loopback", "http://academy.akomapa.org"],
    ["the literal null", "null"],
  ])("refuses %s", (_label, value) => {
    expect(parseConfiguredOrigin(value)).toBeNull();
  });
});

describe("parseVercelHost", () => {
  it("trusts a Vercel deployment host over HTTPS", () => {
    expect(parseVercelHost("akomapa-git-dev-akomapa.vercel.app")).toBe(
      "https://akomapa-git-dev-akomapa.vercel.app"
    );
  });

  it("lowercases what it is given", () => {
    expect(parseVercelHost("Akomapa.Vercel.App")).toBe("https://akomapa.vercel.app");
  });

  it.each([
    ["an empty string", ""],
    ["a scheme", "https://akomapa.vercel.app"],
    ["a path", "akomapa.vercel.app/x"],
    ["a port", "akomapa.vercel.app:443"],
    ["a wildcard", "*.vercel.app"],
    ["credentials", "user@akomapa.vercel.app"],
    ["whitespace inside", "akomapa .vercel.app"],
    ["a query", "akomapa.vercel.app?x"],
    ["a fragment", "akomapa.vercel.app#x"],
  ])("refuses %s", (_label, value) => {
    expect(parseVercelHost(value)).toBeNull();
  });
});

describe("resolveTrustedOrigins", () => {
  it("builds the set from every source, without duplicates", () => {
    const trusted = resolveTrustedOrigins({
      NEXT_PUBLIC_APP_URL: "https://academy.akomapa.org",
      NEXT_PUBLIC_SITE_URL: "https://academy.akomapa.org/",
      TRUSTED_ORIGINS: "https://www.akomapa.academy, https://staging.akomapa.org,",
      VERCEL_URL: "akomapa-abc123.vercel.app",
      VERCEL_BRANCH_URL: "akomapa-git-dev.vercel.app",
      VERCEL_PROJECT_PRODUCTION_URL: "academy.akomapa.org",
    });

    expect(trusted.problems).toEqual([]);
    expect([...trusted.origins].sort()).toEqual([
      "https://academy.akomapa.org",
      "https://akomapa-abc123.vercel.app",
      "https://akomapa-git-dev.vercel.app",
      "https://staging.akomapa.org",
      "https://www.akomapa.academy",
    ]);
  });

  it("ignores unset and blank variables", () => {
    const trusted = resolveTrustedOrigins({
      NEXT_PUBLIC_APP_URL: "http://localhost:3000",
      NEXT_PUBLIC_SITE_URL: "",
      TRUSTED_ORIGINS: "  ",
      VERCEL_URL: undefined,
    });

    expect(trusted.problems).toEqual([]);
    expect([...trusted.origins]).toEqual(["http://localhost:3000"]);
  });

  it("names each malformed variable once, and never its value", () => {
    const trusted = resolveTrustedOrigins({
      NEXT_PUBLIC_APP_URL: "https://academy.akomapa.org",
      TRUSTED_ORIGINS: "https://*.akomapa.org, http://insecure.example",
      VERCEL_URL: "https://not-a-bare-host.vercel.app",
    });

    expect(trusted.problems).toEqual(["TRUSTED_ORIGINS", "VERCEL_URL"]);
    expect(trusted.problems.join(" ")).not.toContain("akomapa.org");
  });

  it("reports an empty configuration rather than trusting nothing silently", () => {
    expect(resolveTrustedOrigins({}).problems).toEqual(["no trusted origin is configured"]);
  });

  it("reads process.env by default", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://from-process.example");

    expect(resolveTrustedOrigins().origins.has("https://from-process.example")).toBe(true);
  });
});

describe("evaluateOrigin", () => {
  it.each(["GET", "HEAD", "OPTIONS", "get"])(
    "does not apply to a safe %s request, whatever its headers",
    (method) => {
      expect(
        evaluateOrigin(method, headers({ origin: "https://evil.example" }), TRUSTED)
      ).toEqual({ ok: true });
    }
  );

  it.each(["POST", "PUT", "PATCH", "DELETE", "post"])(
    "accepts a same-origin %s",
    (method) => {
      expect(evaluateOrigin(method, headers(SAME_ORIGIN), TRUSTED)).toEqual({ ok: true });
    }
  );

  it("accepts a trusted Origin from a browser that does not send Fetch Metadata", () => {
    // Safari before 16.4 and other older engines send Origin but not
    // Sec-Fetch-Site. Origin alone is still a sufficient signal.
    expect(evaluateOrigin("POST", headers({ origin: APP }), TRUSTED)).toEqual({ ok: true });
  });

  it("accepts the local development origin", () => {
    expect(
      evaluateOrigin("POST", headers({ origin: "http://localhost:3000" }), TRUSTED)
    ).toEqual({ ok: true });
  });

  it("treats an unknown method as one that can change state", () => {
    expect(evaluateOrigin("PROPFIND", headers({}), TRUSTED)).toEqual({
      ok: false,
      reason: "missing_origin",
    });
  });

  describe("refuses", () => {
    it.each([
      ["a cross-site request", { origin: "https://evil.example", "sec-fetch-site": "cross-site" }, "fetch_site_cross_site"],
      // Subdomain confusion: a sibling subdomain is "same-site" to the browser,
      // and SameSite=Lax cookies flow to it. It is still another application.
      ["a sibling subdomain", { origin: "https://forum.akomapa.org", "sec-fetch-site": "same-site" }, "fetch_site_same_site"],
      ["a user-initiated navigation", { origin: APP, "sec-fetch-site": "none" }, "fetch_site_none"],
      ["an unrecognised Sec-Fetch-Site", { origin: APP, "sec-fetch-site": "trusted" }, "fetch_site_invalid"],
      // Fetch Metadata is checked first, but a same-origin claim does not
      // excuse the Origin check.
      ["a same-origin claim with a foreign Origin", { origin: "https://evil.example", "sec-fetch-site": "same-origin" }, "untrusted_origin"],
      ["a same-origin claim with no Origin", { "sec-fetch-site": "same-origin" }, "missing_origin"],
      ["a missing Origin", {}, "missing_origin"],
      ["a blank Origin", { origin: "   " }, "missing_origin"],
      ["a null Origin", { origin: "null" }, "null_origin"],
      ["a null Origin in another case", { origin: "NULL" }, "null_origin"],
      ["a protocol-relative Origin", { origin: "//academy.akomapa.org" }, "malformed_origin"],
      ["a bare hostname", { origin: "academy.akomapa.org" }, "malformed_origin"],
      ["an Origin with a trailing slash", { origin: `${APP}/` }, "malformed_origin"],
      ["an Origin with a path", { origin: `${APP}/dashboard` }, "malformed_origin"],
      ["an Origin with an explicit default port", { origin: `${APP}:443` }, "malformed_origin"],
      ["an Origin in uppercase", { origin: "HTTPS://ACADEMY.AKOMAPA.ORG" }, "malformed_origin"],
      ["an Origin with credentials", { origin: "https://academy.akomapa.org@evil.example" }, "malformed_origin"],
      ["an opaque-scheme Origin", { origin: "data:text/html,hi" }, "malformed_origin"],
      ["a file Origin", { origin: "file://" }, "malformed_origin"],
      ["the trusted host as a prefix of another", { origin: "https://academy.akomapa.org.evil.example" }, "untrusted_origin"],
      ["the trusted host as a suffix of another", { origin: "https://evilacademy.akomapa.org" }, "untrusted_origin"],
      ["a sibling subdomain without Fetch Metadata", { origin: "https://forum.akomapa.org" }, "untrusted_origin"],
      ["the parent domain", { origin: "https://akomapa.org" }, "untrusted_origin"],
      // Same host, wrong scheme: an HTTP page on our own domain could be
      // injected by a network attacker.
      ["the trusted host over HTTP", { origin: "http://academy.akomapa.org" }, "untrusted_origin"],
      ["the trusted host on another port", { origin: "https://academy.akomapa.org:8443" }, "untrusted_origin"],
      ["localhost on another port", { origin: "http://localhost:3001" }, "untrusted_origin"],
    ] as const)("%s", (_label, values, reason) => {
      expect(evaluateOrigin("POST", headers(values), TRUSTED)).toEqual({ ok: false, reason });
    });

    it("refuses everything when nothing is trusted", () => {
      expect(evaluateOrigin("POST", headers(SAME_ORIGIN), new Set())).toEqual({
        ok: false,
        reason: "untrusted_origin",
      });
    });
  });

  describe("proxy host handling", () => {
    // The trusted set is configuration. A forwarded or rewritten Host must not
    // make an attacker's Origin match, which it would if the guard compared
    // Origin with the request's own host.
    it.each([
      ["X-Forwarded-Host", { "x-forwarded-host": "evil.example", "x-forwarded-proto": "https" }],
      ["Host", { host: "evil.example" }],
      ["Forwarded", { forwarded: "host=evil.example;proto=https" }],
    ])("ignores a spoofed %s", (_label, spoofed) => {
      expect(
        evaluateOrigin(
          "POST",
          headers({ origin: "https://evil.example", ...spoofed }),
          TRUSTED
        )
      ).toEqual({ ok: false, reason: "untrusted_origin" });
    });

    it("still accepts the trusted origin behind a proxy that rewrites Host", () => {
      // Vercel's edge forwards to the function with its own Host values; the
      // decision must not depend on them.
      expect(
        evaluateOrigin(
          "POST",
          headers({
            ...SAME_ORIGIN,
            host: "internal-function.vercel.internal",
            "x-forwarded-host": "academy.akomapa.org",
          }),
          TRUSTED
        )
      ).toEqual({ ok: true });
    });
  });
});

describe("enforceTrustedOrigin", () => {
  const env = { NEXT_PUBLIC_APP_URL: APP };

  it("returns quietly for a trusted request", () => {
    expect(() => enforceTrustedOrigin("POST", headers(SAME_ORIGIN), "/api/x", env)).not.toThrow();
    expect(logWarn).not.toHaveBeenCalled();
  });

  it("throws untrusted_origin and logs the reason, not the response", () => {
    let thrown: unknown;
    try {
      enforceTrustedOrigin(
        "delete",
        headers({ origin: "https://evil.example", "sec-fetch-site": "cross-site" }),
        "/api/journal/1",
        env
      );
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(ApiError);
    const error = thrown as ApiError;
    expect(error.code).toBe("untrusted_origin");
    expect(logWarn).toHaveBeenCalledWith("ORIGIN_REJECTED", {
      correlationId: error.correlationId,
      reason: "fetch_site_cross_site",
      method: "DELETE",
      path: "/api/journal/1",
      origin: "https://evil.example",
      fetchSite: "cross-site",
    });
  });

  it("truncates an oversized Origin before logging it", () => {
    const huge = `https://${"a".repeat(500)}.example`;

    expect(() =>
      enforceTrustedOrigin("POST", headers({ origin: huge }), "/api/x", env)
    ).toThrow(ApiError);

    const context = logWarn.mock.calls[0][1] as { origin: string; fetchSite?: string };
    expect(context.origin).toHaveLength(128);
    expect(context.fetchSite).toBeUndefined();
  });

  it("fails closed with a logged 500 when the configuration is malformed", () => {
    let thrown: unknown;
    try {
      // Even a request from the otherwise-trusted origin is refused: a broken
      // allow-list is not evidence of anything.
      enforceTrustedOrigin("POST", headers(SAME_ORIGIN), "/api/x", {
        NEXT_PUBLIC_APP_URL: APP,
        TRUSTED_ORIGINS: "https://*.akomapa.org",
      });
    } catch (error) {
      thrown = error;
    }

    expect((thrown as ApiError).code).toBe("internal");
    expect(logError).toHaveBeenCalledWith("ORIGIN_CONFIG", expect.any(Error), {
      correlationId: (thrown as ApiError).correlationId,
      variables: "TRUSTED_ORIGINS",
    });
  });

  it("fails closed when no origin is configured at all", () => {
    expect(() => enforceTrustedOrigin("POST", headers(SAME_ORIGIN), "/api/x", {})).toThrow(
      expect.objectContaining({ code: "internal" })
    );
  });

  it("checks configuration before it considers the method", () => {
    // Configuration is checked before the method: a misconfigured deployment
    // should surface on the first request, not only on the first mutation.
    expect(() => enforceTrustedOrigin("GET", headers({}), "/api/x", {})).toThrow(
      expect.objectContaining({ code: "internal" })
    );
  });
});

describe("assertTrustedOrigin", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", APP);
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    vi.stubEnv("TRUSTED_ORIGINS", "");
    vi.stubEnv("VERCEL_URL", "");
    vi.stubEnv("VERCEL_BRANCH_URL", "");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "");
  });

  it("accepts a same-origin Request", () => {
    const request = new Request(`${APP}/api/journal`, { method: "POST", headers: SAME_ORIGIN });

    expect(() => assertTrustedOrigin(request)).not.toThrow();
  });

  it("refuses a cross-site Request and logs only its pathname", () => {
    const request = new Request(`${APP}/api/journal?token=secret`, {
      method: "POST",
      headers: { origin: "https://evil.example" },
    });

    expect(() => assertTrustedOrigin(request)).toThrow(
      expect.objectContaining({ code: "untrusted_origin" })
    );
    expect(logWarn.mock.calls[0][1]).toMatchObject({ path: "/api/journal" });
    expect(JSON.stringify(logWarn.mock.calls[0][1])).not.toContain("secret");
  });

  it("still decides when the request URL cannot be parsed", () => {
    // Not reachable through Next.js, which always builds an absolute URL; a
    // logging detail must still never be what decides the outcome.
    const request = {
      url: "not a url",
      method: "POST",
      headers: new Headers({ origin: "https://evil.example" }),
    } as unknown as Request;

    expect(() => assertTrustedOrigin(request)).toThrow(
      expect.objectContaining({ code: "untrusted_origin" })
    );
    expect(logWarn.mock.calls[0][1]).toMatchObject({ path: "unknown" });
  });
});

describe("isUploadThingServerCallback", () => {
  const url = "https://academy.akomapa.org/api/uploadthing?slug=courseImage";

  it.each(["callback", "error"])("recognises a %s hook with no actionType", (hook) => {
    const request = new Request(url, { method: "POST", headers: { "uploadthing-hook": hook } });

    expect(isUploadThingServerCallback(request)).toBe(true);
  });

  it("does not exempt a browser upload request", () => {
    const request = new Request(`${url}&actionType=upload`, { method: "POST" });

    expect(isUploadThingServerCallback(request)).toBe(false);
  });

  it("does not exempt an upload request that also claims to be a hook", () => {
    const request = new Request(`${url}&actionType=upload`, {
      method: "POST",
      headers: { "uploadthing-hook": "callback" },
    });

    expect(isUploadThingServerCallback(request)).toBe(false);
  });

  it("does not exempt an unknown hook value", () => {
    const request = new Request(url, {
      method: "POST",
      headers: { "uploadthing-hook": "anything" },
    });

    expect(isUploadThingServerCallback(request)).toBe(false);
  });

  it("does not exempt a request whose URL cannot be parsed", () => {
    const request = {
      url: "not a url",
      headers: new Headers({ "uploadthing-hook": "callback" }),
    } as unknown as Request;

    expect(isUploadThingServerCallback(request)).toBe(false);
  });
});
