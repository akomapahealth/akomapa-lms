# Cross-site request protection

How cookie-authenticated mutations are protected against cross-site request
forgery, which origins are trusted in each environment, and what to do when the
guard refuses a request it should not.

- **Status:** Proposed in the #45 pull request; approved on merge
- **Owner:** Prince Agyei Tuffour (@nanaagyei)
- **Implemented by:** [#45](https://github.com/akomapahealth/akomapa-lms/issues/45)
- **Code:** `lib/http/origin.ts` (the decision and the exemption list),
  `lib/http/action-origin.ts` (Server Actions)
- **Enforced by:** `tests/unit/http/origin-coverage.test.ts`

## The threat

Clerk keeps the learner signed in with a session cookie, and a browser attaches
that cookie to a request whichever site started it. Without a check, any page a
learner visits could post a form to `/api/journal`, or a faculty member's
browser could be made to call `DELETE /api/courses/:id`, and the handler would
see a valid session.

`SameSite=Lax` on Clerk's cookie narrows this, but it treats every subdomain of
the registrable domain as the same site, and it is a property of a third
party's cookie rather than a decision this application makes and tests.

## The strategy

Every `POST`, `PUT`, `PATCH`, and `DELETE` route handler calls
`assertTrustedOrigin(req)` as the first statement of its `try`, before it
resolves the principal or reads the body. The guard refuses the request unless:

1. **`Sec-Fetch-Site`**, when the browser sends it, is `same-origin`.
   `same-site` is refused on purpose: a sibling subdomain is a different
   application, and trusting it is subdomain confusion. `cross-site`, `none`,
   and unknown values are refused.
2. **`Origin`** is present, in the canonical form browsers send (lowercase, no
   trailing slash, no default port), and exactly equal to a trusted origin.
   Browsers send `Origin` on every non-GET request, same-origin included, so
   its absence fails closed. `null` (sandboxed frames, `data:` documents) is
   refused, as are protocol-relative values like `//evil.example` and lookalikes
   like `https://academy.example.org.evil.example`.

A refused request answers **403 `untrusted_origin`** (see
[api-errors.md](../api-errors.md)) and writes a `ORIGIN_REJECTED` warning with
the reason, method, path, and the truncated `Origin`. The reason is never in the
response: telling a prober which check failed tells them which header to work on.

Because the guard runs first, a refusal costs nothing and reveals nothing: an
anonymous cross-site probe gets 403, not 401, and learns nothing about the
session.

### What it deliberately does not consult

- **`Host`, `X-Forwarded-Host`, `X-Forwarded-Proto`, `Forwarded`.** The trusted
  set is configuration and is never derived from the request, so a proxy that
  forwards a spoofed host cannot make an attacker's origin match.
- **`Referer`.** Strippable and policy-dependent. `Origin` is the stronger
  signal, and its absence fails closed rather than falling back.

### Why not a CSRF token

Every mutation in the app is a same-origin `fetch`. A synchronizer or
double-submit token would add a round trip and client state without closing
anything the two checks leave open. If a cross-origin client is ever needed, it
needs a token-authenticated API, not a wider allow-list.

### Preflight

No route answers a CORS preflight with `Access-Control-Allow-Origin`, so a
browser will not send a cross-origin JSON or custom-header request at all. The
guard exists for the requests that need no preflight: form posts and
`text/plain` bodies. `e2e/origin-guard.spec.ts` asserts both against the
production build.

### Referrer-Policy

The guard depends on browsers sending a real `Origin`. Under
`Referrer-Policy: no-referrer`, some browsers send `Origin: null` on same-origin
form posts, which the guard would refuse. `next.config.mjs` sets
`strict-origin-when-cross-origin`, and the coverage test keeps it that way.

## Trusted origins

The trusted set is built on every request from these variables. Each value is
validated, and any malformed value makes the guard refuse **every** mutation with
a logged 500 (`ORIGIN_CONFIG`). A typo must not silently widen or empty the
allow-list.

| Variable | Form | Source |
| --- | --- | --- |
| `NEXT_PUBLIC_APP_URL` | Absolute origin | Set per environment. Already required for Stripe redirects. |
| `NEXT_PUBLIC_SITE_URL` | Absolute origin | Set per environment when the canonical site differs. |
| `TRUSTED_ORIGINS` | Comma-separated absolute origins | Extra domains that serve the app's pages. Server-only, read at runtime. |
| `VERCEL_URL` | Bare host | Vercel system variable: this deployment's unique URL. |
| `VERCEL_BRANCH_URL` | Bare host | Vercel system variable: the branch alias of a preview. |
| `VERCEL_PROJECT_PRODUCTION_URL` | Bare host | Vercel system variable: the production domain. |

Rules for every value:

- **No wildcards.** `https://*.example.org` is a configuration error. List each
  origin.
- **Origins, not URLs.** Scheme, host, and optional port. A trailing slash is
  accepted; a path, query, fragment, or credentials is an error.
- **HTTPS, except loopback.** `http://` is accepted only for `localhost`,
  `127.0.0.1`, and `[::1]`.
- **Exact match.** `https://example.org` and `https://www.example.org` are
  different origins. So are `http://localhost:3000` and `http://127.0.0.1:3000`.

### Per environment

| Environment | Trusted origins | What to set |
| --- | --- | --- |
| Local development | `http://localhost:3000` | `NEXT_PUBLIC_APP_URL` in `.env.local`, as in `.env.example`. If you run on another port or open the app as `127.0.0.1`, change it or add that origin to `TRUSTED_ORIGINS`. |
| Vercel preview | The deployment URL and the branch URL | Nothing. Vercel provides `VERCEL_URL` and `VERCEL_BRANCH_URL` as long as **Automatically expose System Environment Variables** stays on in the project settings. A custom preview domain goes in `TRUSTED_ORIGINS`, scoped to Preview. |
| Staging | The staging domain | `NEXT_PUBLIC_APP_URL` set to the staging origin in the environment that deploys it. |
| Production | The production domain | `NEXT_PUBLIC_APP_URL` set to the canonical origin. Vercel adds `VERCEL_PROJECT_PRODUCTION_URL`. If an alias such as `www` serves pages rather than redirecting, add it to `TRUSTED_ORIGINS`. |
| CI | `http://localhost:3000` | `NEXT_PUBLIC_APP_URL` in `.github/workflows/ci.yml`. |
| Unit and integration tests | `http://localhost:3000` | Pinned by `pinTrustedOrigins()` in `tests/support/origin.ts`, so a developer's `.env.local` cannot change results. |

Changing a variable on Vercel takes effect on the next deployment.

## Exemptions

These handlers do not call the guard. Each is authenticated by a signature from
a known sender, not by a session cookie, so there is no ambient credential for a
cross-site page to ride on, and each sender sends no `Origin`, which the guard
would refuse. The list in code is `ORIGIN_GUARD_EXEMPTIONS`, and the coverage
test checks it against the handlers in both directions.

| Handler | Scope | Verified by |
| --- | --- | --- |
| `app/api/webhook/route.ts` | All requests | Stripe signature (`Stripe-Signature`, `STRIPE_WEBHOOK_SECRET`) |
| `app/api/webhooks/clerk/route.ts` | All requests | Svix signature (`svix-*` headers, `CLERK_WEBHOOK_SECRET`) |
| `app/api/uploadthing/route.ts` | Server callbacks only | UploadThing HMAC (`x-uploadthing-signature`, `UPLOADTHING_TOKEN`) |

UploadThing shares one POST between two callers. A browser requesting upload
slots (`?actionType=upload`) is guarded like any other mutation. UploadThing's
servers call back with an `uploadthing-hook` header and no `actionType`. Only
that exact shape skips the guard, and the library verifies its signature before
acting. A cross-site page cannot add the custom header without a preflight this
application never approves.

Scheduled jobs ([#69](https://github.com/akomapahealth/akomapa-lms/issues/69))
run as `GET` requests authenticated by `CRON_SECRET`, so they need no entry. If
one is ever a `POST`, it goes on this list with its verification.

## Server Actions

There are none today. Next.js already refuses a Server Action whose `Origin` does
not match its `Host`. That check is kept, and `serverActions.allowedOrigins` is
never set to widen it. Any Server Action added later must call
`await assertTrustedActionOrigin()` first, which applies the same allow-list and
Fetch Metadata rule as the route handlers. The coverage test fails the build on
an exported Server Action that does not.

## Adding a mutating route

1. Make `assertTrustedOrigin(req)` the first statement of the handler's `try`.
2. Export the handler as a function declaration
   (`export async function POST(req: Request)`), so the coverage test can see
   into it.
3. If it is a webhook authenticated by a signature, add it to
   `ORIGIN_GUARD_EXEMPTIONS` and to the table above, naming what verifies it.
   Being unauthenticated is not a reason for an exemption.

## Operations

### Reading the logs

- `ORIGIN_REJECTED` (warning) is expected traffic: scanners, stale tabs, and
  the occasional attack. A burst from **one of our own domains** means that
  origin is missing from the allow-list. Check `origin` and `reason` in the log
  line, and quote the `correlationId` from the user's error response to find it.
- `ORIGIN_CONFIG` (error) means a variable in the table above is malformed. Its
  `variables` field names which one, never the value. Every mutation is failing
  until it is fixed.

### Rollout

1. Merge to `dev` and let the Vercel preview deploy. Sign in on the preview and
   exercise a write from each area: a Journal entry, a Community post, a Course
   edit, an upload, and a checkout. Each should succeed, and no
   `ORIGIN_REJECTED` line should name the preview's own origin.
2. Before promoting, confirm that production's `NEXT_PUBLIC_APP_URL` is the
   origin users actually load, and add any alias that serves pages to
   `TRUSTED_ORIGINS`.
3. After the production deploy, watch `ORIGIN_REJECTED` and `ORIGIN_CONFIG` for
   the first hour.

### Rollback

- **A legitimate origin is refused:** add it to `TRUSTED_ORIGINS` and redeploy.
  Never add a wildcard.
- **Every mutation fails with `ORIGIN_CONFIG`:** fix the variable it names and
  redeploy.
- **Anything else:** use Vercel's instant rollback to the previous production
  deployment, then revert the merge on `dev`. There is deliberately no runtime
  switch to turn the guard off. A switch is one misconfiguration away from an
  unprotected production.

No data migration is involved. Rolling back changes request handling only.
