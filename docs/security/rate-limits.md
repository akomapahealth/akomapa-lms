# Rate limits and abuse controls

How sensitive and expensive operations are rate limited, what each route's
limits are, what happens when the limiter's store fails, and how to operate it.

- **Status:** Proposed in the #46 pull request; approved on merge
- **Owner:** Prince Agyei Tuffour (@nanaagyei)
- **Implemented by:** [#46](https://github.com/akomapahealth/akomapa-lms/issues/46)
- **Code:** `lib/rate-limit/` (`lib/rate-limit/policies.ts` is the table below)
- **Enforced by:** `tests/unit/rate-limit/coverage.test.ts`, `tests/unit/rate-limit/policies.test.ts`

## What it protects

Every mutating route is limited. The issue names the operations that need their
own limits, because abuse of them costs money, a third-party quota, or other
learners' experience: Community writes, Quiz start and submit, checkout,
certificate generation, uploads, provider webhooks, and AI. Everything else
shares a generous baseline.

**Sign-in** is Clerk's, not this application's. There is no sign-in, sign-up,
or password-reset endpoint in `app/api/`; Clerk's hosted flow applies its own
brute-force and bot protection. The Clerk webhook, the only Clerk-adjacent
route here, is limited below. A **billing portal** route does not exist yet.
When one is added it uses `checkout.create`.

## How it works

`enforceRateLimit(req, policy, { userId })` is called once per handler:

1. **after** the origin guard ([csrf.md](csrf.md)), so a cross-site page cannot
   spend a victim's allowance;
2. **after** the principal is resolved, so the per-user bucket is the caller's
   own, derived on the server and never taken from the request;
3. **before** the resource the request names is read, so a 429 is the same
   whether or not that Course, post, or attempt exists. Limits are keyed on who
   is asking and what kind of thing they are doing, never on what they asked
   for.

An unauthenticated or cross-site request is refused before the limiter runs and
spends nothing.

### The algorithm

GCRA, the Generic Cell Rate Algorithm: a token bucket stored as one timestamp
per key. Each limit has two numbers that mean what they say:

- **burst**: how many requests may arrive back to back from a full bucket;
- **sustained**: how many per period may arrive indefinitely after that.

A refused request does not consume, and the response says exactly when the same
request would succeed.

### The store

PostgreSQL, table `RateLimitBucket`. Each decision is one atomic
`INSERT ... ON CONFLICT DO UPDATE`. The row lock serialises concurrent requests
for one key across every serverless instance, so the burst is exact rather than
approximate. Per-process memory would give each instance its own full
allowance, which is why there is no in-memory store outside the test suite.
The integration suite proves the exact-burst property with 40 concurrent
requests split across two independent connection pools.

PostgreSQL rather than a separate cache: it is already the system of record,
needs no new vendor or credentials, and the integration harness tests it for
real. The store sits behind an interface (`RateLimitStore`), so moving to a
dedicated cache later changes one file.

Expired rows (past `expiresAt`) are equivalent to absent ones. A consume sweeps
up to 500 of them with probability 1/100, and the daily outbox run
([#69](https://github.com/akomapahealth/akomapa-lms/issues/69),
[runbooks/outbox.md](../runbooks/outbox.md)) sweeps another batch.

### Which address

Only the platform's verified source is trusted: `x-vercel-forwarded-for`, and
only when `VERCEL=1`. Vercel overwrites the forwarding headers at its edge and
does not pass client values through. Off Vercel there is no verified source, so
no header is believed. Otherwise a client could rotate `X-Forwarded-For` for a
fresh bucket per request.

- **IPv6** is keyed by its /64 network. One subscriber routinely holds a whole
  /64, and keying by full address would hand out 2^64 buckets.
- **IPv4-mapped IPv6** (`::ffff:a.b.c.d`) shares the IPv4 bucket.
- **Unknown address.** An authenticated caller is limited by user alone. A
  shared "unknown" bucket would let one person exhaust it for everybody. An
  anonymous caller with no verified address shares one bucket per policy,
  because shared is safer than unlimited.

### Privacy

Bucket keys are `HMAC-SHA256(policy, dimension, subject)` under a key derived
with HKDF from `CLERK_SECRET_KEY` and a purpose label. Neither a user id nor an
IP address is stored, and an IPv4 key cannot be reversed by enumeration without
the secret. Rotating the Clerk key resets every bucket, which is harmless. A
row expires within one sustained period of the bucket's last use: one hour for
every current policy. See the data inventory in
[policy 01](../policies/01-data-protection.md) and the retention schedule in
[policy 02](../policies/02-retention-and-deletion.md).

## Policies

Per-address limits are deliberately loose. Learners on a university or hospital
network share one public address, and a per-address limit sized for one person
would lock out a classroom. The per-user limit is the tight one. The
per-address limit bounds what anonymous or many-account abuse can do.
`tests/unit/rate-limit/policies.test.ts` asserts that no per-address limit is
tighter than its per-user limit.

| Policy | Per user: burst, sustained | Per address: burst, sustained | Store failure |
| --- | --- | --- | --- |
| `write.default` | 30, 600/hour | 120, 3000/hour | allow |
| `community.post` | 3, 20/hour | 20, 200/hour | allow |
| `community.comment` | 10, 120/hour | 60, 1200/hour | allow |
| `community.react` | 30, 600/hour | 120, 3000/hour | allow |
| `quiz.start` | 5, 30/hour | 60, 1200/hour | allow |
| `quiz.submit` | 5, 60/hour | 60, 1200/hour | allow |
| `checkout.create` | 3, 10/hour | 20, 60/hour | deny |
| `certificate.generate` | 3, 10/hour | 20, 100/hour | deny |
| `upload.request` | 10, 100/hour | 60, 600/hour | deny |
| `webhook.stripe` | none | 200, 10000/hour | allow |
| `webhook.clerk` | none | 200, 10000/hour | allow |
| `ai.request` | 5, 50/hour | 30, 300/hour | deny |

`ai.request` is reserved. AI is disabled in v1 ([ADR 0006](../adr/0006-ai-provider-abstraction.md)).
[#71](https://github.com/akomapahealth/akomapa-lms/issues/71) must apply it to
every AI route, and [#73](https://github.com/akomapahealth/akomapa-lms/issues/73)'s
monthly quotas and cost caps sit on top of it. A per-request limit is not a
spend control.

### Routes

| Route | Method | Policy | Keys |
| --- | --- | --- | --- |
| `/api/community/posts` | POST | `community.post` | user, address |
| `/api/community/posts/[postId]` | PATCH | `community.post` | user, address |
| `/api/community/posts/[postId]/comments` | POST | `community.comment` | user, address |
| `/api/community/comments/[commentId]` | PATCH | `community.comment` | user, address |
| `/api/community/posts/[postId]/like` | POST | `community.react` | user, address |
| `/api/community/comments/[commentId]/like` | POST | `community.react` | user, address |
| `/api/courses/[courseId]/quizzes/[quizId]/start` | POST | `quiz.start` | user, address |
| `/api/courses/[courseId]/quizzes/[quizId]/submit` | POST | `quiz.submit` | user, address |
| `/api/courses/[courseId]/checkout` | POST | `checkout.create` | user, address |
| `/api/courses/[courseId]/certificate` | POST | `certificate.generate` | user, address |
| `/api/uploadthing` (browser upload requests) | POST | `upload.request` | user when signed in, address |
| `/api/webhook` | POST | `webhook.stripe` | address, before signature verification |
| `/api/webhooks/clerk` | POST | `webhook.clerk` | address, before signature verification |
| Every other POST, PUT, PATCH, DELETE under `/api` | | `write.default` | user, address |

UploadThing's signed server callbacks are not limited. Each follows an upload
slot that `upload.request` already counted, and each is signature-verified.

## Responses

- **429 `rate_limited`** with `Retry-After` in whole seconds: the bucket is
  exhausted. Logged as `RATE_LIMITED`.
- **503 `temporarily_unavailable`** with `Retry-After: 30`: the store failed
  and the policy fails closed. Logged as `RATE_LIMIT_STORE_FAILURE`.

Neither body names the policy, the dimension, or the limit. See
[api-errors.md](../api-errors.md). The web app turns a 429 into "Please try
again in N minutes" (`lib/api-error-message.ts`), so a learner is told to wait
rather than invited to retry at once.

## When the store fails

A query error, a missing `CLERK_SECRET_KEY`, or no answer within **1.5 seconds**
counts as a store failure. A limiter that hangs a request is a denial of service
it inflicted on itself. What happens next is per policy:

- **allow** for learning, Community, and webhooks. Refusing a learner, or
  losing a Stripe event, during a database hiccup is worse than a brief window
  without limits.
- **deny** for checkout, certificates, uploads, and AI, where an unbounded burst
  costs money or a third-party quota. Answered as 503 with `Retry-After: 30`.

Because the store is the application's own database, a store outage usually
means the routes behind it are failing too. The distinction matters for partial
failures: lock contention, a slow replica, an exhausted pool.

## Operations

### Events

Structured log lines from `lib/logger.ts`. Each carries a `correlationId` and
never a user id, address, bucket key, or request content.

| Event | Level | Fields | Meaning |
| --- | --- | --- | --- |
| `RATE_LIMITED` | warn | `policy`, `dimension` (`user` or `ip`), `retryAfterSeconds` | A request was refused with 429 |
| `RATE_LIMIT_STORE_FAILURE` | error | `policy`, `onStoreFailure` | The store failed; the request was allowed or answered 503 accordingly |
| `RATE_LIMIT_SWEEP` | error | none | The expired-row sweep failed. Housekeeping only |

### Alert thresholds

Until [#102](https://github.com/akomapahealth/akomapa-lms/issues/102) brings
metrics and alerting, these are queries over Vercel's runtime logs. #102 turns
them into alerts.

| Signal | Threshold | Action |
| --- | --- | --- |
| `RATE_LIMIT_STORE_FAILURE` | Any for more than 5 minutes | Treat as a database incident ([policy 06](../policies/06-incident-response.md)). Checkout, certificates, and uploads are answering 503 |
| `RATE_LIMITED` for one policy | More than 50 in 5 minutes | Look for abuse: is `dimension` mostly `ip` (one source) or `user` (one account)? |
| `RATE_LIMITED` for `quiz.*`, `community.*`, or `write.default` | Learner complaints, or a steady trickle during normal use | The limit may be too tight for real use. Tune it (below) |
| `RATE_LIMITED` for `webhook.*` | Any | A provider is redelivering a backlog faster than 200 at once. Stripe retries a 429, so nothing is lost, but check the provider's dashboard |
| Rows in `RateLimitBucket` | More than 1 million | The sweep is not keeping up. Run the manual sweep below |

### Tuning a limit

Change the numbers in `lib/rate-limit/policies.ts` and the table above in the
same pull request; `tests/unit/rate-limit/policies.test.ts` fails if they disagree. A change takes
effect on deploy. Existing buckets keep their stored timestamp and are judged
by the new numbers from the next request.

### Manual sweep

```sql
DELETE FROM "RateLimitBucket" WHERE "expiresAt" < now() AT TIME ZONE 'UTC';
```

### Resetting one learner

Keys are HMACs, so a single learner's bucket cannot be found by user id from
SQL. Waiting one period always resets it. In an emergency, deleting every
bucket for one policy is safe: everyone gets a full allowance.

### Rollout

1. The migration `20261003000000_add_rate_limit_buckets` is additive and
   applies at build time. The runtime role gets access through the existing
   default privileges. Confirm with `npm run db:roles` after deploy.
2. On the preview deployment, exercise one write from each area. Each should
   succeed and add rows to `RateLimitBucket`.
3. After the production deploy, watch `RATE_LIMITED` and
   `RATE_LIMIT_STORE_FAILURE` for the first day. Tighten or loosen with evidence.

### Rollback

- **A limit is too tight:** raise it in `lib/rate-limit/policies.ts` and redeploy. Don't
  remove the call from the route; the coverage test will refuse.
- **The store misbehaves:** Vercel instant rollback to the previous deployment,
  then revert the merge on `dev`. The table can stay. Old code ignores it.
- **Removing the table** (only after the code is reverted):
  `DROP TABLE "RateLimitBucket";`. It holds only short-lived, pseudonymous
  counters. Nothing else references it.

### Row-level security

When [#43](https://github.com/akomapahealth/akomapa-lms/issues/43) enables RLS,
`RateLimitBucket` is system state, not a learner's data. It needs a policy that
lets the runtime role read and write every row regardless of principal, because
the limiter runs before, and independently of, any principal-scoped access.

## Adding a mutating route

Call `await enforceRateLimit(req, "<policy>", { userId: principal.userId })` on
the line right after `requirePrincipal()`, with an existing policy. Use
`write.default` unless the operation costs money, a quota, or other learners'
experience, and in that case add a policy here and in `lib/rate-limit/policies.ts` together.
