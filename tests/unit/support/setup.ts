import { afterEach, beforeEach, vi } from "vitest";

import { resetDbMock } from "./db";

/**
 * Global determinism guarantees for the unit suite.
 *
 * A unit test that passes on one machine and fails on another is worse than no
 * test, because it trains reviewers to re-run CI instead of reading failures.
 * The three non-deterministic inputs available to this codebase are the clock,
 * the timezone, and `Math.random`, so all three are pinned here.
 */

// The clock: the wall time a test observes must not depend on when CI runs.
// Individual tests move the clock with `freezeTimeAt()` from ./time.
process.env.TZ = "UTC";

// `lib/roles.ts` grants ADMIN to `process.env.TEACHER_ID`. If a developer has
// that set in a local shell, authorization tests would pass for the wrong
// reason. Clear it; the tests that care set it explicitly.
delete process.env.TEACHER_ID;

const REAL_RANDOM = Math.random;

/**
 * A small deterministic PRNG (mulberry32). Seeded identically for every test so
 * that any code reaching for `Math.random` gets a reproducible sequence rather
 * than an irreproducible failure.
 */
function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

beforeEach(() => {
  // Re-arm the Prisma double *after* Vitest's own mockReset has run, so each
  // test starts from the documented empty-database defaults.
  resetDbMock();

  Math.random = seededRandom(0x9e3779b9);

  // Unit tests must not perform I/O. Failing loudly here is far easier to debug
  // than a hung socket or, worse, a test that quietly hits a real service.
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: unknown) => {
      throw new Error(
        `Network access is not allowed in the unit suite (attempted fetch to ${String(input)}). ` +
          `Mock the client, or move this case to the integration suite (#107).`
      );
    })
  );
});

afterEach(() => {
  Math.random = REAL_RANDOM;
  vi.useRealTimers();
});
