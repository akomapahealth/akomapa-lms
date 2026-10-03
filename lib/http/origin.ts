import { logError, logWarn } from "@/lib/logger";

import { ApiError } from "./problem";

/**
 * Cross-site request protection for cookie-authenticated mutations (#45).
 *
 * Clerk authenticates the browser with a session cookie, and a browser attaches
 * cookies to a request regardless of which site started it. Without a check,
 * any page the learner visits could submit a form to `/api/journal` or call
 * `DELETE /api/courses/:id` with their session. `SameSite=Lax` on the cookie
 * narrows that, but it is a property of a third party's cookie rather than a
 * decision this application makes and can test, and it treats every subdomain
 * of the registrable domain as the same site.
 *
 * The strategy is the one OWASP lists for stateless APIs: verify where the
 * request came from, using headers a page cannot forge from another origin.
 *
 * 1. `Sec-Fetch-Site`, when the browser sends it, must be `same-origin`.
 *    `same-site` is refused on purpose: a sibling subdomain is a different
 *    application with different code, and trusting it is subdomain confusion.
 * 2. `Origin` must be present, well formed, and exactly equal to one of the
 *    configured trusted origins. Browsers send it on every non-GET request,
 *    same-origin included, so its absence from a mutation is either a
 *    non-browser client or a stripped header -- and neither is a browser
 *    session this guard can vouch for.
 *
 * A synchronizer token was considered and not adopted: every mutation is a
 * same-origin `fetch`, so a token adds a round trip and client state without
 * closing anything the two checks above leave open. If a cross-origin client is
 * ever legitimately needed, it needs a token-authenticated API, not a widened
 * allow-list.
 *
 * What this guard deliberately does not consult:
 * - `Host`, `X-Forwarded-Host`, `X-Forwarded-Proto`. The trusted set is
 *   configuration, never derived from the request, so a proxy that forwards a
 *   spoofed host cannot make the attacker's origin look like ours.
 * - `Referer`. Policy-dependent and strippable; `Origin` is the stronger signal
 *   and its absence fails closed rather than falling back.
 *
 * Trusted origins per environment are documented in docs/security/csrf.md.
 */

/** Methods that cannot change state, and therefore need no origin check. */
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/** Loopback hosts, the only ones allowed to be trusted over plain HTTP. */
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/** Upper bound on how much of a rejected `Origin` header reaches a log line. */
const LOGGED_ORIGIN_CHARS = 128;

/**
 * Why a request was refused. Logged, never returned: telling a prober which
 * check failed tells them which header to work on.
 */
export type OriginRejection =
  | "fetch_site_cross_site"
  | "fetch_site_same_site"
  | "fetch_site_none"
  | "fetch_site_invalid"
  | "missing_origin"
  | "null_origin"
  | "malformed_origin"
  | "untrusted_origin";

export type OriginVerdict =
  | { ok: true }
  | { ok: false; reason: OriginRejection };

export interface TrustedOrigins {
  /** Exact serialized origins, e.g. `https://academy.akomapa.org`. */
  origins: ReadonlySet<string>;
  /**
   * Configuration faults, named by variable. Any entry makes the guard refuse
   * every mutation: a typo in the allow-list must not silently widen or empty it.
   */
  problems: string[];
}

/** The environment variables the trusted set is built from. */
export const TRUSTED_ORIGIN_SOURCES = {
  /** Absolute origins: scheme, host, and optional port. */
  origins: ["NEXT_PUBLIC_APP_URL", "NEXT_PUBLIC_SITE_URL"],
  /** A comma-separated list of absolute origins, for extra domains. */
  list: "TRUSTED_ORIGINS",
  /** Bare hostnames Vercel provides at runtime; trusted as `https://<host>`. */
  vercelHosts: ["VERCEL_URL", "VERCEL_BRANCH_URL", "VERCEL_PROJECT_PRODUCTION_URL"],
} as const;

/**
 * Parses one configured origin, or explains why it is not one.
 *
 * Strict by design. Wildcards, paths, queries, credentials, and non-HTTP
 * schemes are configuration errors rather than things to normalise away,
 * because the alternative is an allow-list that means something other than
 * what it says. Plain HTTP is accepted only for loopback, so a production
 * origin cannot be trusted over a downgradeable transport.
 */
export function parseConfiguredOrigin(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.includes("*")) return null;

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (url.protocol === "http:" && !LOOPBACK_HOSTS.has(url.hostname)) return null;
  if (url.username !== "" || url.password !== "") return null;
  if (url.pathname !== "/" || url.search !== "" || url.hash !== "") return null;

  return url.origin;
}

/**
 * Parses a bare hostname from Vercel's system variables into an HTTPS origin.
 *
 * Vercel sets these without a scheme (`akomapa-git-dev.vercel.app`). Anything
 * with a scheme, path, port, or wildcard is not what Vercel sends and is
 * refused rather than guessed at.
 */
export function parseVercelHost(value: string): string | null {
  const host = value.trim().toLowerCase();
  if (host.length === 0 || /[/:*@?#\s]/.test(host)) return null;

  return parseConfiguredOrigin(`https://${host}`);
}

/**
 * Builds the trusted set from the environment.
 *
 * Read on each call rather than cached at import: a module-level cache would
 * freeze whatever the build environment held, and route handlers on Vercel
 * read their configuration at runtime.
 */
export function resolveTrustedOrigins(
  env: Record<string, string | undefined> = process.env
): TrustedOrigins {
  const origins = new Set<string>();
  const problems: string[] = [];

  const add = (name: string, value: string | undefined, parse: (v: string) => string | null) => {
    if (value === undefined || value.trim() === "") return;
    const origin = parse(value);
    if (origin === null) {
      problems.push(name);
    } else {
      origins.add(origin);
    }
  };

  for (const name of TRUSTED_ORIGIN_SOURCES.origins) {
    add(name, env[name], parseConfiguredOrigin);
  }

  const list = env[TRUSTED_ORIGIN_SOURCES.list];
  if (list !== undefined && list.trim() !== "") {
    for (const entry of list.split(",")) {
      // An empty entry from a trailing comma is a formatting slip, not an origin.
      if (entry.trim() === "") continue;
      add(TRUSTED_ORIGIN_SOURCES.list, entry, parseConfiguredOrigin);
    }
  }

  for (const name of TRUSTED_ORIGIN_SOURCES.vercelHosts) {
    add(name, env[name], parseVercelHost);
  }

  if (origins.size === 0 && problems.length === 0) {
    problems.push("no trusted origin is configured");
  }

  return { origins, problems: [...new Set(problems)] };
}

/**
 * Decides whether a request's provenance is trustworthy. Pure: no logging, no
 * environment access, so every branch is a table-driven unit test.
 */
export function evaluateOrigin(
  method: string,
  headers: Pick<Headers, "get">,
  trusted: ReadonlySet<string>
): OriginVerdict {
  if (SAFE_METHODS.has(method.toUpperCase())) return { ok: true };

  const fetchSite = headers.get("sec-fetch-site");
  if (fetchSite !== null) {
    switch (fetchSite.trim().toLowerCase()) {
      case "same-origin":
        break;
      case "same-site":
        return { ok: false, reason: "fetch_site_same_site" };
      case "cross-site":
        return { ok: false, reason: "fetch_site_cross_site" };
      case "none":
        // A user-initiated navigation (a typed URL, a bookmark). It cannot
        // carry a mutation a page meant to send.
        return { ok: false, reason: "fetch_site_none" };
      default:
        return { ok: false, reason: "fetch_site_invalid" };
    }
  }

  const origin = headers.get("origin");
  if (origin === null || origin.trim() === "") {
    return { ok: false, reason: "missing_origin" };
  }

  // Sent by sandboxed iframes, `data:` documents, and some redirect chains --
  // opaque origins that cannot be attributed to anyone.
  if (origin.trim().toLowerCase() === "null") {
    return { ok: false, reason: "null_origin" };
  }

  // A browser serializes `Origin` canonically: lowercase scheme and host, no
  // default port, no trailing slash. Anything else was written by hand, so it
  // is compared only if it round-trips unchanged. This is what refuses
  // protocol-relative values (`//evil.example`), embedded credentials, and
  // `https://academy.akomapa.org.evil.example`-style suffix tricks before the
  // set lookup is even reached.
  let canonical: string;
  try {
    canonical = new URL(origin).origin;
  } catch {
    return { ok: false, reason: "malformed_origin" };
  }
  if (canonical !== origin || canonical === "null") {
    return { ok: false, reason: "malformed_origin" };
  }

  if (!trusted.has(canonical)) {
    return { ok: false, reason: "untrusted_origin" };
  }

  return { ok: true };
}

/**
 * Throws unless the request may mutate state on behalf of its session cookie.
 *
 * Shared by route handlers and Server Actions so the two cannot drift.
 * `path` is for the log line only.
 */
export function enforceTrustedOrigin(
  method: string,
  headers: Pick<Headers, "get">,
  path: string,
  env: Record<string, string | undefined> = process.env
): void {
  const trusted = resolveTrustedOrigins(env);

  if (trusted.problems.length > 0) {
    // A server fault, not the caller's: answered as a 500 so it pages someone,
    // and refused rather than allowed because a broken allow-list is not
    // evidence that the request is safe.
    const error = new ApiError("internal", {
      message: "trusted origin configuration is invalid",
    });
    logError("ORIGIN_CONFIG", new Error("trusted origin configuration is invalid"), {
      correlationId: error.correlationId,
      variables: trusted.problems.join(","),
    });
    throw error;
  }

  const verdict = evaluateOrigin(method, headers, trusted.origins);
  if (verdict.ok) return;

  const error = new ApiError("untrusted_origin", {
    message: `origin rejected: ${verdict.reason}`,
  });
  // The raw header is attacker-chosen but not secret, and it is the one fact
  // that distinguishes an attack from a missing entry in TRUSTED_ORIGINS. It
  // is truncated, and the production logger serializes it as a JSON string.
  logWarn("ORIGIN_REJECTED", {
    correlationId: error.correlationId,
    reason: verdict.reason,
    method: method.toUpperCase(),
    path,
    origin: headers.get("origin")?.slice(0, LOGGED_ORIGIN_CHARS),
    fetchSite: headers.get("sec-fetch-site")?.slice(0, 32),
  });
  throw error;
}

/**
 * The guard every cookie-authenticated route handler calls first (#45).
 *
 * It must be the first statement inside the handler's `try`, before the body is
 * read or the principal is resolved: a refused request should cost nothing and
 * reveal nothing, including whether the caller is signed in.
 * `tests/unit/http/origin-coverage.test.ts` enforces both the call and its
 * position for every mutating handler under `app/api/`.
 */
export function assertTrustedOrigin(request: Request): void {
  // Pathname only: a query string can carry identifiers that do not belong in
  // a log line.
  let path = "unknown";
  try {
    path = new URL(request.url).pathname;
  } catch {
    // A Request always has an absolute URL in Next.js; the fallback keeps the
    // guard total rather than letting a logging detail decide a status.
  }

  enforceTrustedOrigin(request.method, request.headers, path);
}

/**
 * Whether a request to `/api/uploadthing` is one of UploadThing's own server
 * callbacks rather than a browser's upload request.
 *
 * UploadThing's servers call back with an `uploadthing-hook` header and no
 * `actionType` query parameter, and the library verifies those calls with an
 * HMAC signature over the body before acting on them. They carry no `Origin`,
 * so the origin guard would refuse them. A browser cannot exploit this
 * exemption: a cross-site page cannot attach a custom header without a CORS
 * preflight this application never approves, and a forged hook without a valid
 * signature is rejected by UploadThing.
 *
 * The match is exact -- both conditions -- so a browser request that adds the
 * header *and* asks for an upload is still guarded.
 */
export function isUploadThingServerCallback(request: Request): boolean {
  const hook = request.headers.get("uploadthing-hook");
  if (hook !== "callback" && hook !== "error") return false;

  let actionType: string | null;
  try {
    actionType = new URL(request.url).searchParams.get("actionType");
  } catch {
    return false;
  }

  return actionType === null;
}

/**
 * Mutating route handlers that do not call the guard, and why.
 *
 * Each is authenticated by a signature from a known sender rather than by a
 * session cookie, so there is no ambient credential for a cross-site page to
 * ride on -- and the senders are servers that send no `Origin` at all, which the
 * guard would refuse. `tests/unit/http/origin-coverage.test.ts` checks this list
 * against the code in both directions: an exempt handler must not call the
 * guard, and every other mutating handler must.
 *
 * A scheduled job added by #69 runs as a GET authenticated by `CRON_SECRET`,
 * so it needs no entry here; if one is ever a POST, it belongs on this list.
 */
export const ORIGIN_GUARD_EXEMPTIONS = [
  {
    file: "app/api/webhook/route.ts",
    methods: ["POST"],
    scope: "all",
    verifiedBy: "Stripe signature (Stripe-Signature, STRIPE_WEBHOOK_SECRET)",
  },
  {
    file: "app/api/webhooks/clerk/route.ts",
    methods: ["POST"],
    scope: "all",
    verifiedBy: "Svix signature (svix-id/-timestamp/-signature, CLERK_WEBHOOK_SECRET)",
  },
  {
    file: "app/api/uploadthing/route.ts",
    methods: ["POST"],
    // Browser upload requests are guarded; only signed server callbacks pass.
    scope: "signed-callbacks",
    verifiedBy: "UploadThing HMAC signature (x-uploadthing-signature, UPLOADTHING_TOKEN)",
  },
] as const;
