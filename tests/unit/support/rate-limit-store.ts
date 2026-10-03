import { decide } from "@/lib/rate-limit/gcra";
import type { RateLimitStore } from "@/lib/rate-limit/store";

/**
 * An in-memory rate-limit store for the unit suite.
 *
 * It lives here, not in lib/, on purpose: per-process memory is the wrong store
 * for serverless (#46), and keeping the only implementation in the test tree
 * means production code cannot reach for it. It uses the same `decide()` the
 * PostgreSQL statement is checked against, so it is a faithful double of the
 * arithmetic; the concurrency and SQL are the integration suite's to prove.
 */
export function memoryStore(): RateLimitStore & {
  buckets: Map<string, number>;
  calls: string[];
} {
  const buckets = new Map<string, number>();
  const calls: string[] = [];

  return {
    buckets,
    calls,
    async consume(key, now, rate, cost) {
      calls.push(key);
      const decision = decide(buckets.get(key) ?? null, now, rate, cost);
      if (decision.allowed) buckets.set(key, decision.tat);
      return decision;
    },
  };
}

/** A store that fails every call, as a database outage would. */
export function failingStore(error: unknown = new Error("connection refused")): RateLimitStore {
  return {
    async consume() {
      throw error;
    },
  };
}

/** A store that never answers, as a hung connection would. */
export function hangingStore(): RateLimitStore {
  return {
    consume: () => new Promise(() => {}),
  };
}
