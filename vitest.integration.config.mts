import { fileURLToPath } from "node:url";

import { config } from "dotenv";
import { defineConfig } from "vitest/config";

// An exported TEST_DATABASE_URL or DATABASE_URL wins over the dotenv files, so
// pointing a run at a throwaway server is one shell prefix and cannot be
// silently overridden by .env.local (which is loaded with override: true).
const explicit = {
  TEST_DATABASE_URL: process.env.TEST_DATABASE_URL,
  DATABASE_URL: process.env.DATABASE_URL,
};

config();
config({ path: ".env.local", override: true });

for (const [key, value] of Object.entries(explicit)) {
  if (value) process.env[key] = value;
}

/**
 * Integration suite (#107).
 *
 * These tests talk to a real PostgreSQL database created from the committed
 * migrations. That is the point: RLS policies, constraints, cascades,
 * transaction and concurrency behaviour cannot be observed against a mock, and
 * a policy regression is invisible to the unit suite by construction
 * (ADR 0003).
 *
 * Kept in its own config rather than a second project in vitest.config.mts so
 * that `npm run test:unit` stays fast and needs no database, and so CI can run
 * the two on different runners.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
      "server-only": fileURLToPath(
        new URL("./node_modules/server-only/empty.js", import.meta.url)
      ),
    },
  },
  test: {
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    globalSetup: ["tests/integration/support/global-setup.ts"],
    setupFiles: ["tests/integration/support/setup.ts"],

    // A database round trip is orders of magnitude slower than a mocked call,
    // and cloning the template plus applying migrations happens before the
    // first test runs.
    testTimeout: 30_000,
    hookTimeout: 60_000,

    // Each worker owns its own database, so workers are isolated from each
    // other. Tests within a file share one, so they must not run concurrently.
    fileParallelism: true,
    sequence: { concurrent: false },

    // No coverage thresholds here. Coverage is the unit suite's gate; this
    // suite exists to prove behaviour that coverage cannot see.
  },
});
