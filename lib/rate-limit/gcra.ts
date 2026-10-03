/**
 * The Generic Cell Rate Algorithm, as pure arithmetic (#46).
 *
 * GCRA is a token bucket expressed as a single timestamp, the "theoretical
 * arrival time" (TAT): the moment the bucket would be full again. A request
 * pushes the TAT forward by its cost; it is allowed if the TAT stays within the
 * burst window from now. One number per key is why the store can make the
 * decision in a single atomic statement (see store.ts), and why the same
 * function serves both that statement's interpretation and the unit tests.
 *
 * A limit therefore has two parameters, and they mean what they say:
 * - **burst**: how many requests may arrive at once from a full bucket;
 * - **sustained**: how many per period may arrive indefinitely after that.
 *
 * All values are integer milliseconds.
 */

export interface Limit {
  /** Requests allowed back to back from a full bucket. At least 1. */
  burst: number;
  /** The long-run rate: `limit` requests per `periodSeconds`. */
  sustained: { limit: number; periodSeconds: number };
}

/** A limit converted into the two intervals the algorithm uses. */
export interface Rate {
  /** Milliseconds one unit of cost occupies: period / limit, rounded up. */
  emissionMs: number;
  /** Milliseconds of headroom a full bucket holds: burst x emission. */
  capacityMs: number;
}

export interface Decision {
  allowed: boolean;
  /** The TAT to store. Unchanged from the previous value on a denial. */
  tat: number;
  /** Milliseconds until the same request would be allowed. 0 when allowed. */
  retryAfterMs: number;
  /** Whole requests of the same cost still available right now. */
  remaining: number;
}

/**
 * Rejects a limit that cannot mean anything. Called when policies load, so a
 * typo in the policy table fails a test rather than silently allowing
 * everything (a zero limit) or nothing (a burst of zero).
 */
export function assertValidLimit(limit: Limit, label: string): void {
  const { burst, sustained } = limit;
  const integers = [burst, sustained.limit, sustained.periodSeconds];
  if (!integers.every((value) => Number.isSafeInteger(value) && value >= 1)) {
    throw new Error(`rate limit ${label}: burst, limit, and period must be positive integers`);
  }
  if (burst > sustained.limit) {
    // A burst larger than the whole period's allowance would let a client
    // spend more than the sustained rate in the first instant.
    throw new Error(`rate limit ${label}: burst cannot exceed the sustained limit`);
  }
}

export function rateOf(limit: Limit): Rate {
  // Rounded up so integer arithmetic never allows more than the stated rate.
  const emissionMs = Math.ceil((limit.sustained.periodSeconds * 1000) / limit.sustained.limit);
  return { emissionMs, capacityMs: limit.burst * emissionMs };
}

/**
 * Decides one request.
 *
 * @param previousTat the stored TAT, or null for a key never seen (or expired).
 * @param cost units this request consumes; 1 for an ordinary request.
 */
export function decide(previousTat: number | null, now: number, rate: Rate, cost = 1): Decision {
  if (!Number.isSafeInteger(cost) || cost < 1) {
    throw new Error("rate limit cost must be a positive integer");
  }

  const increment = cost * rate.emissionMs;
  // A TAT in the past means the bucket has refilled completely: count from now.
  const base = previousTat === null ? now : Math.max(previousTat, now);
  const candidate = base + increment;
  const occupied = candidate - now;

  if (occupied <= rate.capacityMs) {
    return {
      allowed: true,
      tat: candidate,
      retryAfterMs: 0,
      remaining: Math.floor((rate.capacityMs - occupied) / increment),
    };
  }

  return {
    allowed: false,
    tat: previousTat ?? now,
    retryAfterMs: occupied - rate.capacityMs,
    remaining: 0,
  };
}
