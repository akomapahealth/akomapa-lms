import { ApiError, newCorrelationId } from "@/lib/http/problem";
import { logError, logWarn } from "@/lib/logger";

import { clientAddress } from "./client-ip";
import { rateOf, type Decision } from "./gcra";
import { bucketKey } from "./key";
import { RATE_LIMIT_POLICIES, type RateLimitPolicyName } from "./policies";
import { postgresStore, type RateLimitStore } from "./store";

/**
 * Abuse controls for sensitive and expensive operations (#46).
 *
 * A route handler calls `enforceRateLimit` once, after the origin guard and
 * after it knows who the caller is, and before it touches the resource the
 * request names. That order is the contract:
 *
 * - after the origin guard, so a cross-site page cannot spend a victim's
 *   allowance (#45);
 * - after the principal, so the per-user bucket is the caller's own;
 * - before the resource lookup, so a 429 is the same whether or not the Course,
 *   post, or attempt exists -- the limit is keyed on who is asking and what
 *   kind of thing they are doing, never on what they asked for.
 *
 * Policies, numbers, and failure behaviour: ./policies.ts and
 * docs/security/rate-limits.md. `tests/unit/rate-limit/coverage.test.ts`
 * enforces that every mutating route calls this with a policy.
 */

export { RATE_LIMIT_POLICIES, type RateLimitPolicyName } from "./policies";

/**
 * How long a decision may take before the store is treated as failed. A rate
 * limiter that hangs a request is a denial of service it inflicted on itself.
 */
export const STORE_TIMEOUT_MS = 1500;

/** The `Retry-After` sent when a fail-closed policy cannot reach its store. */
export const STORE_FAILURE_RETRY_SECONDS = 30;

export interface RateLimitSubject {
  /** The authenticated user, from the server-derived principal. Never the body. */
  userId?: string | null;
}

export interface RateLimitOptions {
  /** Units this request consumes. Defaults to 1; must not exceed the burst. */
  cost?: number;
  /** Injected for tests. */
  store?: RateLimitStore;
  now?: () => number;
  env?: Record<string, string | undefined>;
}

interface Bucket {
  dimension: "user" | "ip";
  key: string;
  rate: ReturnType<typeof rateOf>;
}

class StoreTimeout extends Error {
  constructor() {
    super(`rate-limit store did not answer within ${STORE_TIMEOUT_MS}ms`);
    this.name = "StoreTimeout";
  }
}

function withTimeout<T>(work: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new StoreTimeout()), STORE_TIMEOUT_MS);
  });
  return Promise.race([work, timeout]).finally(() => clearTimeout(timer));
}

/**
 * The buckets a request draws from.
 *
 * A known user draws from their user bucket and, when the platform verified
 * one, their address bucket. When the address is unknown -- off Vercel, or a
 * missing header -- an authenticated caller is limited by user alone, because a
 * single shared "unknown" bucket would let one person exhaust it for everyone.
 * An anonymous caller with an unknown address does share that bucket: there is
 * nothing else to key on, and shared is safer than unlimited.
 */
function bucketsFor(
  policyName: RateLimitPolicyName,
  request: Request,
  subject: RateLimitSubject,
  env: Record<string, string | undefined>
): Bucket[] {
  const policy = RATE_LIMIT_POLICIES[policyName];
  const buckets: Bucket[] = [];
  const userId = subject.userId ?? null;
  const userLimit = "user" in policy ? policy.user : undefined;

  if (userLimit !== undefined && userId !== null) {
    buckets.push({
      dimension: "user",
      key: bucketKey(policyName, "user", userId, env),
      rate: rateOf(userLimit),
    });
  }

  const address = clientAddress(request.headers, env);
  if (address.kind === "ip" || buckets.length === 0) {
    const subjectKey = address.kind === "ip" ? address.bucket : "unknown";
    buckets.push({
      dimension: "ip",
      key: bucketKey(policyName, "ip", subjectKey, env),
      rate: rateOf(policy.ip),
    });
  }

  return buckets;
}

/**
 * Throws `rate_limited` (429) when any of the request's buckets is exhausted,
 * or `temporarily_unavailable` (503) when the store fails and the policy fails
 * closed. Returns normally otherwise.
 */
export async function enforceRateLimit(
  request: Request,
  policyName: RateLimitPolicyName,
  subject: RateLimitSubject = {},
  options: RateLimitOptions = {}
): Promise<void> {
  const policy = RATE_LIMIT_POLICIES[policyName];
  const cost = options.cost ?? 1;
  const env = options.env ?? process.env;
  const store = options.store ?? defaultStore();
  const now = (options.now ?? Date.now)();

  // A programming error, not abuse: a cost that cannot fit a bucket would deny
  // forever. Checked before the store is involved so it can never be mistaken
  // for a store failure and waved through.
  const userLimit = "user" in policy ? policy.user : undefined;
  const smallestBurst = Math.min(policy.ip.burst, userLimit?.burst ?? Infinity);
  if (!Number.isSafeInteger(cost) || cost < 1 || cost > smallestBurst) {
    throw new Error(`rate limit ${policyName}: cost ${cost} does not fit burst ${smallestBurst}`);
  }

  let denial: { dimension: string; retryAfterMs: number } | null = null;

  try {
    const buckets = bucketsFor(policyName, request, subject, env);

    for (const bucket of buckets) {
      const decision: Decision = await withTimeout(
        store.consume(bucket.key, now, bucket.rate, cost)
      );
      if (!decision.allowed && (denial === null || decision.retryAfterMs > denial.retryAfterMs)) {
        denial = { dimension: bucket.dimension, retryAfterMs: decision.retryAfterMs };
      }
    }
  } catch (error) {
    // Anything thrown here is the store's -- a query error, a timeout, or a
    // missing key-derivation secret -- and is handled by the policy.
    const correlationId = newCorrelationId();
    logError("RATE_LIMIT_STORE_FAILURE", error, {
      correlationId,
      policy: policyName,
      onStoreFailure: policy.onStoreFailure,
    });

    if (policy.onStoreFailure === "allow") return;

    throw new ApiError("temporarily_unavailable", {
      correlationId,
      retryAfterSeconds: STORE_FAILURE_RETRY_SECONDS,
      message: `rate-limit store unavailable for ${policyName}`,
    });
  }

  if (denial === null) return;

  const retryAfterSeconds = Math.max(1, Math.ceil(denial.retryAfterMs / 1000));
  const error = new ApiError("rate_limited", {
    retryAfterSeconds,
    message: `rate limited: ${policyName}`,
  });
  // Policy and dimension only: never the user id, the address, or the stored
  // key, and never anything from the request body.
  logWarn("RATE_LIMITED", {
    correlationId: error.correlationId,
    policy: policyName,
    dimension: denial.dimension,
    retryAfterSeconds,
  });
  throw error;
}

let store: RateLimitStore | null = null;

function defaultStore(): RateLimitStore {
  store ??= postgresStore();
  return store;
}
