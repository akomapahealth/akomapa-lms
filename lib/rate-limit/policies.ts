import { assertValidLimit, type Limit } from "./gcra";

/**
 * Every rate-limit policy, in one table (#46).
 *
 * A policy names an operation, not a route: two routes that cost the same and
 * are abused the same way share one. Each policy limits by the authenticated
 * user, by client address, or both, and states what happens when the store
 * cannot be reached.
 *
 * **Reading the numbers.** `burst` requests may arrive back to back; after that,
 * `sustained.limit` per `sustained.periodSeconds`. The per-address limits are
 * deliberately loose: learners on a university or hospital network share one
 * public address, and a per-address limit sized for one person would lock out a
 * classroom. The per-user limit is the tight one; the per-address limit exists
 * to bound what anonymous or many-account abuse can do.
 *
 * **Failure behaviour.** `allow` for ordinary learning and community work,
 * where refusing a learner during a database hiccup is worse than briefly
 * unlimited likes. `deny` where an unbounded burst costs money or a third-party
 * quota -- Stripe sessions, certificate rendering, uploads, AI -- answered as 503
 * `temporarily_unavailable`.
 *
 * The documented table in docs/security/rate-limits.md must match this one;
 * tests/unit/rate-limit/policies.test.ts checks that it does.
 */

export interface RateLimitPolicy {
  /** What the policy protects, for logs and the documentation. */
  description: string;
  /** Limit per authenticated user. Omitted for anonymous-only operations. */
  user?: Limit;
  /** Limit per client address (IPv4 address or IPv6 /64). */
  ip: Limit;
  /** What happens when the store fails or times out. */
  onStoreFailure: "allow" | "deny";
}

const HOUR = 3600;

const perHour = (burst: number, limit: number): Limit => ({
  burst,
  sustained: { limit, periodSeconds: HOUR },
});

export const RATE_LIMIT_POLICIES = {
  "write.default": {
    description:
      "Every other cookie-authenticated mutation: Course authoring, Journal, settings, progress, case study attempts, moderation.",
    user: perHour(30, 600),
    ip: perHour(120, 3000),
    onStoreFailure: "allow",
  },
  "community.post": {
    description: "Creating or editing a Community post.",
    user: perHour(3, 20),
    ip: perHour(20, 200),
    onStoreFailure: "allow",
  },
  "community.comment": {
    description: "Creating or editing a Community comment.",
    user: perHour(10, 120),
    ip: perHour(60, 1200),
    onStoreFailure: "allow",
  },
  "community.react": {
    description: "Liking or unliking a post or comment.",
    user: perHour(30, 600),
    ip: perHour(120, 3000),
    onStoreFailure: "allow",
  },
  "quiz.start": {
    description: "Starting a Quiz attempt.",
    user: perHour(5, 30),
    ip: perHour(60, 1200),
    onStoreFailure: "allow",
  },
  "quiz.submit": {
    description: "Submitting a Quiz attempt.",
    user: perHour(5, 60),
    ip: perHour(60, 1200),
    onStoreFailure: "allow",
  },
  "checkout.create": {
    description:
      "Creating a Stripe Checkout session. Each one is a Stripe API call, and unbounded sessions are the shape of card testing.",
    user: perHour(3, 10),
    ip: perHour(20, 60),
    onStoreFailure: "deny",
  },
  "certificate.generate": {
    description: "Rendering a Certificate PDF and storing it with UploadThing.",
    user: perHour(3, 10),
    ip: perHour(20, 100),
    onStoreFailure: "deny",
  },
  "upload.request": {
    description: "Requesting UploadThing upload slots. Storage and Mux ingest are billed.",
    user: perHour(10, 100),
    ip: perHour(60, 600),
    onStoreFailure: "deny",
  },
  "webhook.stripe": {
    description:
      "Stripe webhook deliveries, before signature verification. Generous: Stripe retries a 429, but a backlog after an outage arrives fast.",
    ip: perHour(200, 10000),
    onStoreFailure: "allow",
  },
  "webhook.clerk": {
    description: "Clerk (Svix) webhook deliveries, before signature verification.",
    ip: perHour(200, 10000),
    onStoreFailure: "allow",
  },
  "ai.request": {
    description:
      "Any AI operation. Reserved: AI is disabled in v1 (ADR 0006); #71 must apply this policy, and #73's monthly quotas sit on top of it.",
    user: perHour(5, 50),
    ip: perHour(30, 300),
    onStoreFailure: "deny",
  },
} as const satisfies Record<string, RateLimitPolicy>;

export type RateLimitPolicyName = keyof typeof RATE_LIMIT_POLICIES;

/** Validates every limit in the table. Throws on the first nonsensical one. */
export function assertValidPolicies(
  policies: Record<string, RateLimitPolicy> = RATE_LIMIT_POLICIES
): void {
  for (const [name, policy] of Object.entries(policies)) {
    assertValidLimit(policy.ip, `${name}.ip`);
    if (policy.user) assertValidLimit(policy.user, `${name}.user`);
  }
}

// Fail at import, in every environment, rather than enforce a broken limit.
assertValidPolicies();
