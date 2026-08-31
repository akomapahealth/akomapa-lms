# 0005. Carry asynchronous work through a transactional outbox

- **Status:** Accepted
- **Date:** 2026-08-30
- **Approver:** Prince Agyei Tuffour (@nanaagyei)
- **Implemented by:** [#69](https://github.com/akomapahealth/akomapa-lms/issues/69)

## Context

Work that must happen *because* something was persisted currently happens
inline or not at all: Stripe and Clerk webhooks under
`app/api/webhook/` and `app/api/webhooks/clerk/`, Certificate PDF rendering,
notification email, and Mux asset handling.

Inline side effects fail in both directions. If the effect runs before the
commit and the commit fails, the product has emailed a learner about something
that did not happen. If it runs after the commit and the process dies, the
effect is lost with no record that it was owed. Providers make this worse:
Stripe and Clerk retry, deliver out of order, and can deliver the same event
twice, so a handler that is not idempotent double-writes.

[ADR 0004](0004-transactional-completion-and-events.md) already requires domain
events to be written inside the transaction. This decision defines how they get
out.

## Decision

**Every asynchronous effect is driven by an outbox row written in the same
transaction as the state change, and delivered by an idempotent processor.**

1. **Write the event, not the effect.** A command appends a typed event to an
   outbox table in its own transaction. It never calls an external service
   inline.
2. **At-least-once delivery, idempotent handling.** The processor may deliver
   an event more than once. Every handler is idempotent, keyed on the event id,
   so a repeat delivery is a no-op rather than a duplicate.
3. **Inbound provider events are deduplicated at the edge.** Stripe and Clerk
   webhooks verify their signature, record the provider event id, and reject a
   replay of an id already processed. Verification failure is a rejection, not
   a warning.
4. **Ordering is not assumed.** Handlers tolerate out-of-order and late
   delivery. Where order genuinely matters, it is enforced by the persisted
   state the handler reads, not by arrival sequence.
5. **Failure is bounded and visible.** Delivery retries with backoff up to a
   fixed ceiling, then parks the row for inspection. A parked row raises an
   alert; it never disappears and never retries forever.
6. **Events carry identifiers, not payloads.** An event names the entity and
   the fact. It never carries secrets, tokens, raw payment data, Journal or
   private Community content, answer keys, or AI prompts. Handlers re-read what
   they need under a principal.
7. **The processor is safe to run concurrently.** Rows are claimed so that two
   instances cannot process the same event at once.

## Consequences

- Provider webhooks stop being business logic. They become thin, verified
  ingest that records an event; the work moves to a handler that can be tested
  in isolation and safely retried.
- A new operational surface exists: outbox depth, oldest undelivered event, and
  parked-row count become monitored signals with alerts
  ([#102](https://github.com/akomapahealth/akomapa-lms/issues/102)).
- Effects become eventually consistent. The interface must show honest pending
  states, for example a Certificate that is issued but whose PDF is still
  rendering. DESIGN.md's loading and empty-state vocabulary covers this.
- Every handler needs an idempotency test that delivers the same event twice
  and asserts one outcome, and a replay test that delivers events out of order.
- The processor needs a scheduled invocation. Its schedule, timeout, and
  concurrency are deployment configuration and part of the release checklist.

## Alternatives considered

**Call external services inline inside the transaction.** Rejected: it holds a
database transaction open across a network call, and a provider timeout becomes
a database lock.

**Call external services after commit, without an outbox.** Rejected: a crash
between commit and call loses the effect with no record that it was owed. This
is the current failure mode.

**A dedicated queue such as SQS or Upstash.** Rejected for v1: it introduces a
second store that can disagree with the database, reintroducing the dual-write
problem the outbox exists to solve. An outbox can feed a queue later without
changing the command layer, which is the point of putting the seam here.

**Rely on provider retries alone.** Rejected: it only covers inbound provider
events, and nothing else the system owes.

## Links

- [ADR 0004](0004-transactional-completion-and-events.md)
- `app/api/webhook/`, `app/api/webhooks/clerk/`, `lib/logger.ts`
- Issues [#69](https://github.com/akomapahealth/akomapa-lms/issues/69), [#55](https://github.com/akomapahealth/akomapa-lms/issues/55), [#102](https://github.com/akomapahealth/akomapa-lms/issues/102), [#107](https://github.com/akomapahealth/akomapa-lms/issues/107)
