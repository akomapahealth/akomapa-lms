# 0003. Enforce access in PostgreSQL with a transaction-scoped principal

- **Status:** Accepted
- **Date:** 2026-08-30
- **Approver:** Prince Agyei Tuffour (@nanaagyei)
- **Implemented by:** [#43](https://github.com/akomapahealth/akomapa-lms/issues/43)

## Context

Today every access decision lives in application code. `lib/db.ts` creates one
`PrismaClient` over a `pg` connection pool, cached on `globalThis`, and every
query runs as the same database user with unrestricted rights. A route handler
that forgets a `where` clause returns another learner's data, and the database
will happily serve it.

[ADR 0001](0001-identity-authentication-and-rbac.md) makes the application
layer consistent, which reduces that risk but does not remove it: it still
takes exactly one missing filter. The data at stake includes private Journal
Entries, Quiz answer keys, and Certificates, where a single leak is not
recoverable by a later fix.

Row-level security gives a second, independent enforcement layer. It requires
the database to know who the request is for, and connection pooling means the
connection cannot carry that identity, because the next request gets the same
connection.

## Decision

**Enforce access in PostgreSQL with row-level security, and propagate the
principal per transaction, never per connection.**

1. **RLS is enabled on every table holding learner or tenant-scoped data**, and
   the application's database role is not `BYPASSRLS`. Tables holding only
   reference data may be exempt, and each exemption is recorded in the
   migration that creates it.
2. **The principal is set inside the transaction.** Each request opens a
   transaction, sets the principal on the local session
   (`set_config(..., is_local => true)`), runs its statements, and commits. The
   setting dies with the transaction, so a pooled connection can never leak a
   principal into the next request.
3. **No query runs outside a principal-scoped transaction**, with two named
   exceptions: migrations, and explicitly marked public reads such as
   Certificate verification at `/verify`, which is public by design.
4. **Policies are versioned like migrations.** Policy changes ship as
   migrations, are reviewed as code, and are never applied by hand to an
   environment.
5. **RLS is a second layer, not a replacement.** Application-level checks from
   ADR 0001 stay. RLS is the net that catches the check nobody wrote.
6. **The principal is never derived from request input.** It comes from the
   server-side principal of ADR 0001 and nowhere else.

## Consequences

- Every data access path must run inside the transaction wrapper. Code that
  calls `db` directly outside one will fail once policies deny by default,
  which is the intended failure mode.
- Isolated PostgreSQL integration coverage becomes mandatory
  ([#107](https://github.com/akomapahealth/akomapa-lms/issues/107)): RLS
  policies cannot be tested against a mock, and a policy regression is
  invisible to unit tests.
- Query performance changes. Policies add predicates, so the indexes that
  support them are part of the same work
  ([#51](https://github.com/akomapahealth/akomapa-lms/issues/51)).
- Debugging gets harder in a specific way: a missing principal looks like
  missing data rather than an error. Startup validation and health checks
  ([#103](https://github.com/akomapahealth/akomapa-lms/issues/103)) must assert
  that RLS is on and the role is not bypassing it, so a misconfigured
  environment fails loudly at boot instead of silently serving empty pages.
- Rollback for a policy change is a down migration that drops the policy, which
  widens access. It requires the same approval as any destructive migration.

## Alternatives considered

**Application-layer checks only.** Rejected: one missing predicate is an
unrecoverable disclosure of Journal Entries or answer keys, and ADR 0001 alone
cannot make that structurally impossible.

**A separate database role or connection per principal.** Rejected:
incompatible with connection pooling in a serverless deployment, where the
number of distinct principals per instance is unbounded.

**Setting the principal on the connection rather than the transaction.**
Rejected: pooled connections are reused, so a principal set at connection level
leaks to the next request. This is the specific failure this decision exists to
prevent.

**A Prisma middleware that injects a tenant filter.** Rejected: it enforces in
the same process that could omit it, so it is not an independent layer, and it
does not cover raw SQL.

## Links

- [ADR 0001](0001-identity-authentication-and-rbac.md), [ADR 0004](0004-transactional-completion-and-events.md)
- `lib/db.ts`, `prisma/schema.prisma`
- Issues [#43](https://github.com/akomapahealth/akomapa-lms/issues/43), [#51](https://github.com/akomapahealth/akomapa-lms/issues/51), [#103](https://github.com/akomapahealth/akomapa-lms/issues/103), [#107](https://github.com/akomapahealth/akomapa-lms/issues/107)
