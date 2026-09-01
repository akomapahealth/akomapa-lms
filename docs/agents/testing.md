# Testing

Tests are part of a change, not a phase that follows one. Every feature or fix
adds the coverage its own risk warrants, at the lowest layer that can catch the
defect. The four suites below have distinct jobs; putting a test in the wrong
one is how suites become slow and flaky.

## The suites

| Suite | Command | What belongs in it | Owner |
| --- | --- | --- | --- |
| Unit | `npm run test:unit` | Pure domain logic: entitlement, RBAC, completion, grading, badges, streaks, certificate eligibility, AI usage accounting | [#106](https://github.com/akomapahealth/akomapa-lms/issues/106) |
| Integration | not yet available | Route handlers, RLS policies, transactions, migrations, Stripe and Clerk webhooks, against isolated PostgreSQL | [#107](https://github.com/akomapahealth/akomapa-lms/issues/107) |
| Browser | `npm run test:e2e` | Authenticated learner, faculty, admin, commerce, and AI journeys | [#108](https://github.com/akomapahealth/akomapa-lms/issues/108) |
| Document | `npm run test:checks`, `npm run test:evals` | Source-of-truth documents and the AI evaluation dataset | [#37](https://github.com/akomapahealth/akomapa-lms/issues/37), [#79](https://github.com/akomapahealth/akomapa-lms/issues/79) |

`npm run validate` runs lint, typecheck, and every suite that does not need a
database or a browser. Run it before opening a pull request.

## The unit suite

Runner: Vitest. Configuration lives in `vitest.config.mts`; shared helpers live
in `tests/unit/support/`.

```
npm run test:unit            # once
npm run test:unit:watch      # while working
npm run test:unit:coverage   # with the coverage gate applied
```

### It refuses I/O on purpose

`tests/unit/support/setup.ts` stubs `fetch` to throw and replaces `@/lib/db`
with an in-memory double. A unit test that reaches for a real service fails
with an explanatory message rather than hanging, or — far worse — passing
because it read live state. Anything that genuinely needs a database belongs in
the integration suite.

### Determinism is enforced, not requested

The clock, the timezone (`UTC`), and `Math.random` are all pinned before each
test, and `TEACHER_ID` is cleared so a developer's shell cannot grant ADMIN and
make an authorization test pass for the wrong reason. Use `freezeTimeAt()` from
`tests/unit/support/time.ts` rather than constructing `new Date()` in a test.

### The Prisma double fails closed

Reads default to the answers an empty database would give (`null`, `[]`, `0`).
Writes have no default and reject until a test configures them, so "this code
writes to the database" stays an explicit assertion rather than an accident.

```ts
vi.mock("@/lib/db", async () => ({ db: (await import("./support/db")).dbMock }));

dbMock.user.findUnique.mockResolvedValue(aRoleRow("FACULTY"));
```

### Coverage is an allow-list

`coverage.include` in `vitest.config.mts` names individual files rather than
sweeping the repository, and thresholds are checked **per file**. A module joins
the list in the same pull request that brings it under test. This keeps the
numbers meaningful: a global average across hundreds of untested files says
nothing, and adding one well-covered module must never be able to mask a bare
one. The permission matrix in `lib/auth/policy.ts` is held at 100%.

Adding a module to the list without tests will fail the build. That is the
intent.

### Identity has one entrance

`getPrincipal`, `requirePrincipal`, and `requirePagePrincipal` in `lib/auth` are
the only places Clerk's session is read (ADR 0001 §1). An ESLint rule enforces
it: importing `auth` from `@clerk/nextjs/server` anywhere except `lib/auth/` and
`proxy.ts` fails the build. `currentUser` stays available for profile data such
as an email address, but identity itself comes from the principal.

### Write the negative case first

The failure that matters is rarely "the feature did not work"; it is "the guard
did not hold". Prefer asserting that access is denied, that a badge is not
awarded, that a certificate is not issued. Coverage percentages prove a line
ran, not that anything was checked — for the highest-risk invariants, corrupt
the dependency and assert the deny-by-default contract still holds, as
`tests/unit/roles.test.ts` does at the persistence boundary.

### Characterisation tests

A test may pin a defect that exists today so the issue which fixes it has a
failing test to turn green. Label it with the owning issue and group it under a
`known defects` describe block. Delete it in the pull request that fixes the
defect, not before.
