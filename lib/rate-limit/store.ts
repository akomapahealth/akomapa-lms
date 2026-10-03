import { db } from "@/lib/db";
import { logError } from "@/lib/logger";

import { decide, type Decision, type Rate } from "./gcra";

/**
 * Where buckets live (#46).
 *
 * The interface is what `enforceRateLimit` depends on; `postgresStore` is the
 * production implementation. A per-process store would be wrong by
 * construction on serverless -- every instance would grant its own full
 * allowance -- which is why there is no in-memory implementation outside the
 * test suite.
 */
export interface RateLimitStore {
  /** Atomically decides and records one request against one bucket. */
  consume(key: string, now: number, rate: Rate, cost: number): Promise<Decision>;
}

/**
 * Probability that a consume also sweeps expired buckets. Rows past their
 * `expiresAt` are equivalent to absent ones, so deletion is housekeeping, not
 * correctness; a one-in-a-hundred sweep keeps the table bounded without a
 * scheduled job (#69 brings one; the sweep can move there).
 */
export const SWEEP_PROBABILITY = 0.01;
const SWEEP_BATCH = 500;

interface Row {
  tat: bigint;
  allowed: boolean;
}

/**
 * The production store: one PostgreSQL statement per bucket.
 *
 * `INSERT ... ON CONFLICT DO UPDATE` takes the row lock, so concurrent requests
 * for one key -- from any number of serverless instances -- are serialised by
 * the database and each sees its predecessor's result. Every `SET` expression
 * reads the *existing* row, so the decision and the new TAT are computed from
 * the same snapshot. The `allowed` column carries the decision back in the same
 * round trip; `tat` comes back unchanged on a denial, which is exactly what the
 * retry delay is computed from.
 *
 * The clock is the application's, passed in, rather than the database's
 * `now()`: it keeps the arithmetic in one place (gcra.ts) and the tests
 * deterministic. Serverless instances are NTP-synchronised; a skew of a few
 * milliseconds moves a limit by a few milliseconds.
 */
export function postgresStore(random: () => number = Math.random): RateLimitStore {
  return {
    async consume(key, now, rate, cost) {
      const increment = cost * rate.emissionMs;
      // A fresh bucket always admits a request whose cost fits the burst;
      // enforceRateLimit guarantees cost <= burst, so the inserted row is an
      // allowed one.
      const first = now + increment;

      const rows = await db.$queryRaw<Row[]>`
        INSERT INTO "RateLimitBucket" ("key", "tat", "allowed", "expiresAt")
        VALUES (
          ${key},
          ${BigInt(first)},
          true,
          TIMESTAMP 'epoch' + ${BigInt(first)} * INTERVAL '1 millisecond'
        )
        ON CONFLICT ("key") DO UPDATE SET
          "allowed" =
            GREATEST("RateLimitBucket"."tat", ${BigInt(now)}) + ${BigInt(increment)} - ${BigInt(now)}
              <= ${BigInt(rate.capacityMs)},
          "tat" = CASE
            WHEN GREATEST("RateLimitBucket"."tat", ${BigInt(now)}) + ${BigInt(increment)} - ${BigInt(now)}
              <= ${BigInt(rate.capacityMs)}
            THEN GREATEST("RateLimitBucket"."tat", ${BigInt(now)}) + ${BigInt(increment)}
            ELSE "RateLimitBucket"."tat"
          END,
          "expiresAt" = CASE
            WHEN GREATEST("RateLimitBucket"."tat", ${BigInt(now)}) + ${BigInt(increment)} - ${BigInt(now)}
              <= ${BigInt(rate.capacityMs)}
            THEN TIMESTAMP 'epoch'
              + (GREATEST("RateLimitBucket"."tat", ${BigInt(now)}) + ${BigInt(increment)})
              * INTERVAL '1 millisecond'
            ELSE "RateLimitBucket"."expiresAt"
          END
        RETURNING "tat", "allowed"
      `;

      if (random() < SWEEP_PROBABILITY) {
        await sweepExpired(now);
      }

      const [row] = rows;
      const stored = Number(row.tat);

      if (row.allowed) {
        // The statement and `decide` must agree; recomputing from the stored
        // TAT gives the remaining count without a second query.
        return {
          allowed: true,
          tat: stored,
          retryAfterMs: 0,
          remaining: Math.floor((rate.capacityMs - (stored - now)) / increment),
        };
      }

      // On a denial `tat` is the unchanged previous value: decide() from it
      // yields the same denial and the delay until it would be allowed.
      return decide(stored, now, rate, cost);
    },
  };
}

/**
 * Deletes a bounded batch of expired buckets. Failures are logged and
 * swallowed: housekeeping must never decide a request.
 */
export async function sweepExpired(now: number): Promise<void> {
  try {
    await db.$executeRaw`
      DELETE FROM "RateLimitBucket"
      WHERE "key" IN (
        SELECT "key" FROM "RateLimitBucket"
        WHERE "expiresAt" < TIMESTAMP 'epoch' + ${BigInt(now)} * INTERVAL '1 millisecond'
        LIMIT ${SWEEP_BATCH}
      )
    `;
  } catch (error) {
    logError("RATE_LIMIT_SWEEP", error);
  }
}
