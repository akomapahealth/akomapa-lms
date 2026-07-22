import dns from "node:dns";
import { defineConfig } from "@playwright/test";

// Since Node 17+, "localhost" resolves to IPv6 (::1) first, while `next start`
// listens on IPv4. Force IPv4-first so the webServer readiness poll (and any
// hostname-based request) reaches the server on CI runners.
dns.setDefaultResultOrder("ipv4first");

const PORT = Number(process.env.E2E_PORT ?? 3000);
// Target the numeric loopback 127.0.0.1 rather than the hostname "localhost" to
// skip DNS entirely. These smoke tests use Playwright's Node-based `request`
// client (not a browser), which avoids Chromium's CI networking quirks (e.g.
// net::ERR_NAME_NOT_RESOLVED against loopback) while still exercising the real
// production server booted by `next start`.
const baseURL = process.env.E2E_BASE_URL ?? `http://127.0.0.1:${PORT}`;
const isCI = !!process.env.CI;

/**
 * Playwright config for public smoke tests.
 *
 * These run against a production build served by `next start` and only exercise
 * unauthenticated public routes, so they need no real Clerk/Stripe/DB — CI runs
 * them with placeholder env. Build the app first (`next build`) before running.
 *
 * We deliberately do NOT pass `-H` to `next start`: Next 16 runs a front proxy
 * that forwards to the app at `localhost`, and binding the front to a different
 * host desyncs that target ("Failed to proxy ... ECONNRESET"). Left at its
 * default, `next start` binds all interfaces, so 127.0.0.1 is reachable.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 1 : undefined,
  reporter: isCI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  webServer: {
    command: `npx next start -p ${PORT}`,
    url: baseURL,
    timeout: 120_000,
    reuseExistingServer: !isCI,
  },
});
