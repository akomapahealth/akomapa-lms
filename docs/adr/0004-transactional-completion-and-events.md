# 0004. Completion, grading, and recognition happen in one transaction

- **Status:** Accepted
- **Date:** 2026-08-30
- **Approver:** Prince Agyei Tuffour (@nanaagyei)
- **Implemented by:** [#49](https://github.com/akomapahealth/akomapa-lms/issues/49)

## Context

Completing a Topic is not one write. It updates `UserProgress`, may complete a
Module, may complete a Course, may move an `Enrollment` to `COMPLETED`, may
award a `UserBadge`, may advance a `LearningStreak`, and may issue a
`Certificate`. Submitting a Quiz Attempt is the same shape: persist
`QuizAnswer` rows, score them, close the `QuizAttempt`, and possibly trigger
all of the above.

Performed as separate writes, these steps fail partially. A learner can hold a
Certificate for a Course whose progress rows say otherwise, or a Badge for a
streak that was never recorded. Because a Certificate is publicly verifiable at
`/verify`, an inconsistency here is a public correctness failure, not an
internal one. The spoofing risks in
[#40](https://github.com/akomapahealth/akomapa-lms/issues/40) come from the
same place: derived facts that a client can influence, computed outside a
transaction.

## Decision

**Every derived learning fact is computed on the server and written in one
transaction with the state change that caused it, and that transaction also
records the resulting domain events.**

1. **One command per learning state change.** Completing a Topic and submitting
   a Quiz Attempt are each a single server-side command. A client never issues
   the individual writes.
2. **Derivation, not assertion.** Scores, Module completion, Course completion,
   Badge eligibility, streak advancement, and Certificate issuance are computed
   from persisted rows inside the transaction. A completion, score, or
   entitlement supplied by the browser is rejected, not merged.
3. **All or nothing.** Every write caused by one command commits together or
   none does. There is no state in which a Certificate exists without the
   completion that justifies it.
4. **Events are written in the same transaction.** The command appends its
   domain events to the outbox in the same transaction; delivery is
   [ADR 0005](0005-transactional-outbox-processing.md). No side effect that
   leaves the database, an email or a webhook, happens inline.
5. **Idempotent by construction.** Re-running a command with the same inputs
   produces the same end state and no duplicate Badge, Certificate, or event.
   The existing unique constraints on `UserBadge`, `Certificate`, and
   `UserProgress` are the enforcement, not a convention.
6. **Quiz Attempts are bound to their principal.** An Answer is only ever
   written to an Attempt owned by the acting principal
   ([#41](https://github.com/akomapahealth/akomapa-lms/issues/41)), and the
   answer key is never sent to the client before the Attempt closes.

## Consequences

- Badge, streak, and certificate logic moves out of ad hoc service calls such
  as `lib/badge-service.ts`, `lib/streak-service.ts`, and
  `lib/certificate-service.ts` and into the completion transaction, or into an
  event consumer fed by it. Those modules become pure evaluators, not writers.
- Transactions get longer. External calls, PDF rendering, and email must move
  behind the outbox, because holding a transaction open across a network call
  is how this decision fails.
- Concurrency becomes explicit. Two simultaneous completions of the last Topic
  in a Course must produce one Certificate, which is what the unique constraints
  and the idempotency requirement exist for.
- Integration coverage against a real PostgreSQL instance is required: partial
  failure and concurrent completion cannot be demonstrated against a mock.
- Retroactive repair becomes possible, because the derived state is a pure
  function of persisted rows and can be recomputed.

## Alternatives considered

**Compute derived state in application code after the write, without a
transaction.** Rejected: this is the current behaviour and it is the source of
the spoofing and inconsistency defects.

**Compute progress on read instead of persisting it.** Rejected: Certificates
and Badges are historical facts with an issue date. They must be persisted at
the moment they were earned, not recomputed later against changed content.

**Database triggers.** Rejected: the rules are product rules that change with
the curriculum, and hiding them in triggers puts them outside code review,
typing, and the test suite.

## Links

- [ADR 0003](0003-rls-and-transaction-scoped-principal.md), [ADR 0005](0005-transactional-outbox-processing.md)
- `lib/badge-service.ts`, `lib/streak-service.ts`, `lib/certificate-service.ts`, `prisma/schema.prisma`
- Issues [#40](https://github.com/akomapahealth/akomapa-lms/issues/40), [#41](https://github.com/akomapahealth/akomapa-lms/issues/41), [#49](https://github.com/akomapahealth/akomapa-lms/issues/49), [#63](https://github.com/akomapahealth/akomapa-lms/issues/63)
