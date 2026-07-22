import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3000);
// Target the numeric loopback 127.0.0.1 rather than the hostname "localhost":
// Chromium on CI runners can fail to resolve "localhost"
// (net::ERR_NAME_NOT_RESOLVED), and a numeric address needs no DNS.
//
// We deliberately do NOT pass `-H` to `next start`. Next 16 runs a front proxy
// that forwards to the app at `localhost`; binding the front to a different
// host desyncs that target and causes "Failed to proxy ... ECONNRESET". Left at
// its default, `next start` binds all interfaces, so 127.0.0.1 is reachable.
const baseURL = process.env.E2E_BASE_URL ?? `http://127.0.0.1:${PORT}`;
const isCI = !!process.env.CI;

/**
 * Playwright config for public smoke tests.
 *
 * These run against a production build served by `next start` and only exercise
 * unauthenticated public routes, so they need no real Clerk/Stripe/DB — CI runs
 * them with placeholder env. Build the app first (`next build`) before running.
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
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // Never route loopback traffic through a system/enterprise proxy. Some
        // CI runners (and dev machines) inject a proxy that cannot resolve
        // 127.0.0.1, surfacing as net::ERR_NAME_NOT_RESOLVED. No-op when no
        // proxy is configured.
        launchOptions: { args: ["--no-proxy-server"] },
      },
    },
  ],
  webServer: {
    command: `npx next start -p ${PORT}`,
    url: baseURL,
    timeout: 120_000,
    reuseExistingServer: !isCI,
  },
});
