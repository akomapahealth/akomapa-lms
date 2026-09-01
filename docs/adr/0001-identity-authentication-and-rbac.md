# 0001. Derive the principal and role on the server from Clerk

- **Status:** Accepted
- **Date:** 2026-08-30
- **Approver:** Prince Agyei Tuffour (@nanaagyei)
- **Implemented by:** [#42](https://github.com/akomapahealth/akomapa-lms/issues/42)

## Context

Clerk already owns authentication. `proxy.ts` runs `clerkMiddleware`, declares
a public-route matcher, and calls `auth.protect()` on everything else.
`User.id` in `prisma/schema.prisma` is the Clerk user id, so there is no local
credential store and no second identity to reconcile.

Authorization, however, is scattered. Every route handler repeats the same
shape by hand: `const { userId } = await auth()`, then an ad hoc check such as
`isFaculty(userId)`, then a Prisma query that may or may not re-assert
ownership. `app/api/courses/[courseId]/route.ts` is representative. Three
consequences follow. The check can be forgotten entirely. The check can be
present but the ownership filter absent, which is the cross-course Topic access
defect in
[#39](https://github.com/akomapahealth/akomapa-lms/issues/39). And
the role helpers granted `ADMIN` to whoever matched the `TEACHER_ID`
environment variable, which is authorization by deployment configuration.
(Both the helpers and the variable were removed when this ADR was
implemented; `lib/auth/` replaces them.)

Nothing about identity may be taken from the browser, and today nothing
structurally prevents it.

## Decision

Clerk is the only identity authority. A **principal** is a server-derived pair
of a Clerk user id and a role from `User.role`, and it is the only thing any
authorization decision reads.

1. **One derivation point.** A single server-side module resolves the
   principal from the Clerk session. Route handlers, server actions, and server
   components obtain the principal from it and never call `auth()` and reason
   about the result themselves.
2. **Deny by default.** The absence of a principal, an unresolvable role, or a
   resource whose relationship cannot be fully established denies the request.
   A missing check is a denial, never an allow.
3. **Roles are a total order for capability.** `ADMIN` implies `FACULTY`;
   `FACULTY` does not imply `ADMIN`; `STUDENT` implies neither. Role checks are
   expressed as a required capability, not as string equality scattered through
   handlers.
4. **Ownership is asserted in the query.** Authorization is not a guard that
   runs before an unfiltered query. The complete persisted relationship, for
   example Topic to Module to Course to Enrollment, is expressed in the query
   or transaction that reads or mutates, so an authorized-but-unrelated
   resource cannot be returned.
5. **No client-supplied authority.** `userId`, role, ownership, price, score,
   completion, and entitlement are never accepted from a request body, query
   string, header, or client component prop.
6. **`TEACHER_ID` is retired.** Role comes from `User.role` only. The
   environment fallback in the role helpers is removed, not merely deprecated.

Out of scope: how roles are granted and revoked in the administration UI
([#88](https://github.com/akomapahealth/akomapa-lms/issues/88)), and the
database-level enforcement of the same principal, which is
[ADR 0003](0003-rls-and-transaction-scoped-principal.md).

## Consequences

- Every route handler and server action changes shape: obtain the principal,
  declare the required capability, and query with the relationship asserted.
- Negative authorization tests become the coverage that matters. Each protected
  boundary needs a test proving the wrong principal is denied, not only that
  the right one is allowed.
- Removing `TEACHER_ID` is a breaking operational change. Any deployment
  relying on it must have a real `ADMIN` row on `User` before the change ships,
  and the rollback path is redeploying the previous build, not restoring the
  variable.
- Middleware stays a coarse gate. It authenticates and it protects routes; it
  is never the place a resource-level decision is made, because it cannot see
  the resource.

## Alternatives considered

**Clerk organizations and roles as the source of truth.** Rejected: it moves
authorization data outside the database, so the role cannot participate in a
transaction or in a row-level security policy, which ADR 0003 requires.

**Keep per-handler checks and add lint rules.** Rejected: a lint rule can see a
missing call, but it cannot see a check that runs against the wrong resource,
which is the defect class that actually occurred.

**Middleware-level authorization.** Rejected: middleware has the route and the
session, not the persisted relationship. Deciding Topic access there would
require re-deriving the whole Course graph before the handler runs.

## Links

- [ADR 0002](0002-enrollment-as-canonical-entitlement.md), [ADR 0003](0003-rls-and-transaction-scoped-principal.md)
- [CONTEXT.md](../../CONTEXT.md) invariants
- `proxy.ts`, `lib/auth/`, `prisma/schema.prisma`, [permission matrix](../permission-matrix.md)
- Issues [#39](https://github.com/akomapahealth/akomapa-lms/issues/39), [#42](https://github.com/akomapahealth/akomapa-lms/issues/42), [#86](https://github.com/akomapahealth/akomapa-lms/issues/86)
