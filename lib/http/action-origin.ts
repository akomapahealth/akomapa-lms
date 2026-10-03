import "server-only";

import { headers } from "next/headers";

import { enforceTrustedOrigin } from "./origin";

/**
 * The origin guard for Server Actions (#45).
 *
 * Next.js already refuses a Server Action whose `Origin` does not match the
 * request's `Host` (or `X-Forwarded-Host`). That check is kept, not replaced:
 * `experimental.serverActions.allowedOrigins` stays unset in next.config.mjs, so
 * nothing widens it. This adds the same explicit allow-list and Fetch Metadata
 * rule the route handlers use, so a forwarded host can never be what makes an
 * action trusted, and the two kinds of mutation cannot drift apart.
 *
 * Every exported function in a `"use server"` module calls this first.
 * `tests/unit/http/origin-coverage.test.ts` enforces it. Server Actions are
 * always POST.
 */
export async function assertTrustedActionOrigin(): Promise<void> {
  const requestHeaders = await headers();
  enforceTrustedOrigin("POST", requestHeaders, "server-action");
}
