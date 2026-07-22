import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3000);
// Bind and target 127.0.0.1 rather than "localhost": Chromium on CI runners can
// fail to resolve the "localhost" hostname (net::ERR_NAME_NOT_RESOLVED), while a
// numeric loopback address needs no DNS resolution.
const HOST = process.env.E2E_HOST ?? "127.0.0.1";
const baseURL = process.env.E2E_BASE_URL ?? `http://${HOST}:${PORT}`;
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
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: `npx next start -p ${PORT} -H ${HOST}`,
    url: baseURL,
    timeout: 120_000,
    reuseExistingServer: !isCI,
  },
});
