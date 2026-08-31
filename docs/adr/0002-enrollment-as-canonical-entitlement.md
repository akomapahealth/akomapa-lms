# 0002. Enrollment is the only Course entitlement

- **Status:** Accepted
- **Date:** 2026-08-30
- **Approver:** Prince Agyei Tuffour (@nanaagyei)
- **Implemented by:** [#48](https://github.com/akomapahealth/akomapa-lms/issues/48)

## Context

Two models can currently answer "may this learner see this Course".
`Purchase` records that a Course was paid for. `Enrollment` records that a
learner is on a Course, with a `status` of `ACTIVE`, `COMPLETED`, or
`SUSPENDED`. Both are unique per learner and Course.

Having two answers means call sites disagree. A surface that checks `Purchase`
grants access to a suspended learner. A surface that checks `Enrollment` grants
access to someone who never paid, if an Enrollment was created outside the
payment path. A free Course has no `Purchase` at all, and `Course.price` is
nullable, so "paid" is not even well defined for every Course. Access also has
a third, legitimate source: a `Topic` marked `isFree` is previewable without
either record.

[PRODUCT.md](../../PRODUCT.md#paid-and-free-boundary) fixes the commercial
model as per-Course purchase, which makes the relationship between the two
records a decision rather than an accident.

## Decision

**`Enrollment` is the entitlement. `Purchase` is evidence of payment.**

1. **One question, one API.** A single server-side entitlement API answers
   "may this principal access this Course, and at what level". Every surface,
   route handler, server action, and server component uses it. No feature
   queries `Enrollment` or `Purchase` directly to make an access decision.
2. **Access is granted by an `ACTIVE` Enrollment.** `COMPLETED` grants
   continued read access to the Course and its Certificate. `SUSPENDED` denies
   access, whatever `Purchase` says.
3. **Purchase never grants access on its own.** No authorization path reads
   `Purchase`. Payment is one of the inputs that *creates* an Enrollment, in
   the Stripe reconciliation path
   ([#55](https://github.com/akomapahealth/akomapa-lms/issues/55)), never a
   substitute for one.
4. **Free preview is the only other source of access.** A `Topic` with
   `isFree` is readable without an Enrollment. That is a Topic-level
   exception and never expands to its Module or Course.
5. **Price is never client-supplied.** The amount charged is read from
   `Course.price` on the server at checkout time. A price arriving from the
   browser is rejected.
6. **Entitlement is re-derived, never cached in the client.** No entitlement
   flag is sent to the browser and trusted back.

Out of scope: the AI Pro subscription, which is a separate entitlement and must
never gate Course access. See
[ADR 0006](0006-ai-provider-abstraction.md).

## Consequences

- Course content access, the Course player, grades, Certificates, and Community
  Course association all route through one function, so a fix to entitlement
  logic fixes every surface at once.
- Administrators gain a real suspension capability, because `SUSPENDED` now
  means something enforceable.
- Refunds and chargebacks become an Enrollment state change, not a `Purchase`
  deletion. Deleting payment evidence is never how access is removed.
- Any existing data where a `Purchase` exists without a corresponding
  `Enrollment` must be backfilled before this ships, and the backfill needs its
  own migration evidence and rollback note.
- Free Courses stop being a special case in access code; they are Courses whose
  Enrollment is created without a payment step.

## Alternatives considered

**Keep `Purchase` as the entitlement and drop `Enrollment`.** Rejected: it
cannot express suspension, completion, or non-commercial enrolment such as a
scholarship or a staff account, and it ties access lifetime to a payment
record that must be retained for accounting.

**Compute entitlement as "Purchase exists OR Enrollment is active".** Rejected:
an OR means the weaker condition always wins, so suspension would never take
effect.

**Move entitlement into Clerk metadata.** Rejected: it cannot participate in a
database transaction or a row-level security policy, and it duplicates state
that already has a home.

## Links

- [ADR 0001](0001-identity-authentication-and-rbac.md), [ADR 0003](0003-rls-and-transaction-scoped-principal.md)
- [PRODUCT.md](../../PRODUCT.md#paid-and-free-boundary), [CONTEXT.md](../../CONTEXT.md)
- `prisma/schema.prisma` (`Enrollment`, `Purchase`, `Topic.isFree`, `Course.price`)
- Issues [#48](https://github.com/akomapahealth/akomapa-lms/issues/48), [#53](https://github.com/akomapahealth/akomapa-lms/issues/53), [#54](https://github.com/akomapahealth/akomapa-lms/issues/54), [#55](https://github.com/akomapahealth/akomapa-lms/issues/55), [#56](https://github.com/akomapahealth/akomapa-lms/issues/56)
