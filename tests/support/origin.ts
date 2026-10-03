/**
 * The origin every test request comes from, and the headers a browser on it
 * sends (#45).
 *
 * Shared by the unit and integration suites so a handler test exercises the
 * request a real same-origin `fetch` produces, rather than one the origin guard
 * refuses for lacking the headers every browser attaches.
 */
export const TEST_ORIGIN = "http://localhost:3000";

/** What a current browser sends on a same-origin POST/PUT/PATCH/DELETE. */
export const SAME_ORIGIN_HEADERS = {
  origin: TEST_ORIGIN,
  "sec-fetch-site": "same-origin",
} as const;

/** The variables the guard reads, from lib/http/origin.ts. */
const ORIGIN_VARIABLES = [
  "NEXT_PUBLIC_APP_URL",
  "NEXT_PUBLIC_SITE_URL",
  "TRUSTED_ORIGINS",
  "VERCEL_URL",
  "VERCEL_BRANCH_URL",
  "VERCEL_PROJECT_PRODUCTION_URL",
] as const;

/**
 * Makes TEST_ORIGIN the only trusted origin.
 *
 * A developer's `.env.local` or shell may trust other origins, and a test that
 * passes because of them proves nothing about the code. Called from each suite's
 * setup file so every test starts from the same allow-list.
 */
export function pinTrustedOrigins(): void {
  for (const name of ORIGIN_VARIABLES) delete process.env[name];
  process.env.NEXT_PUBLIC_APP_URL = TEST_ORIGIN;
}
