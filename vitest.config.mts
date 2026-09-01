import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

/**
 * Unit-test harness for core authorization and domain invariants (#106).
 *
 * Scope: pure domain logic only. These tests must never boot Next.js, open a
 * network socket, or reach a real database. Route-level, RLS, transaction, and
 * webhook coverage belongs to the isolated PostgreSQL harness (#107); browser
 * journeys belong to Playwright (#108).
 *
 * `coverage.include` is an allow-list, not a whole-repo sweep. A module joins
 * the list in the same PR that brings it under test, so the thresholds below
 * always describe real, enforced coverage rather than an aspiration diluted by
 * hundreds of untested files. Issues #48, #49, #63, #73, #83, and #84 each add
 * their own entries as they land.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
      // `server-only` is a marker package: outside a React Server Component
      // condition its entry point throws by design. Point it at the package's
      // own empty build so a server-only module can be unit tested, while the
      // Next.js build keeps enforcing the real boundary.
      "server-only": fileURLToPath(
        new URL("./node_modules/server-only/empty.js", import.meta.url)
      ),
    },
  },
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts"],
    setupFiles: ["tests/unit/support/setup.ts"],

    // Determinism: no test may depend on another test's mock state.
    clearMocks: true,
    mockReset: true,
    restoreMocks: true,
    unstubEnvs: true,
    unstubGlobals: true,

    coverage: {
      provider: "v8",
      reporter: ["text-summary", "lcov", "html"],
      reportsDirectory: "coverage/unit",
      include: [
        "lib/auth/*.ts",
        "lib/roles.ts",
        "lib/roles-client.ts",
        "lib/streak-service.ts",
        "lib/badge-service.ts",
        "lib/certificate-service.ts",
      ],
      thresholds: {
        // Per-file, so a well-covered module cannot mask a bare one.
        perFile: true,
        lines: 90,
        functions: 90,
        branches: 85,
        statements: 90,
        // Authorization is the highest-risk surface in the codebase: every
        // branch of it must be exercised, including the deny-by-default paths.
        // The permission matrix is the highest-risk code in the repository.
        "lib/auth/policy.ts": { lines: 100, functions: 100, branches: 100, statements: 100 },
        "lib/auth/actions.ts": { lines: 100, functions: 100, branches: 100, statements: 100 },
        "lib/auth/errors.ts": { lines: 100, functions: 100, branches: 100, statements: 100 },
        "lib/roles.ts": { lines: 100, functions: 100, branches: 100, statements: 100 },
        "lib/roles-client.ts": { lines: 100, functions: 100, branches: 100, statements: 100 },
      },
    },
  },
});
