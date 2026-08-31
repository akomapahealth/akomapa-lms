# 0006. Put AI behind a provider seam with a kill switch

- **Status:** Proposed
- **Date:** 2026-08-30
- **Approver:** pending, gated on [#70](https://github.com/akomapahealth/akomapa-lms/issues/70)
- **Implemented by:** [#71](https://github.com/akomapahealth/akomapa-lms/issues/71)

## Context

AI Pro appears in the domain vocabulary and owns all of Wave 6, but no AI code
exists in the repository today.
[PRODUCT.md](../../PRODUCT.md#ai-pro) records the approved position: AI Pro is
a committed future capability and is **out of scope for v1**. No AI feature
ships in the v1.0.0 release.

The v1 obligation is narrow and real. Wave 6 will introduce a second
entitlement (an AI subscription), a new class of logged data (prompts and model
output), a new cost centre, and a new abuse surface. If the boundaries built in
Waves 1 to 5 assume a single entitlement and unrestricted logging, Wave 6 will
require reworking them. Recording the seam now costs nothing and prevents that.

This record is **Proposed**, not Accepted. The safety posture, threat model,
and evaluation rubric are a `ready-for-human` decision owned by
[#70](https://github.com/akomapahealth/akomapa-lms/issues/70). Do not build
against this record until it is approved.

## Decision

Proposed, pending #70:

1. **One provider seam.** All model access goes through a single internal
   interface. No feature imports a vendor SDK directly, so the provider can be
   changed, mocked in tests, and stubbed in CI without touching feature code.
2. **AI entitlement is separate from Course entitlement.** The AI subscription
   is its own entitlement and is never read by the Course access path.
   Purchased Course access must never depend on AI subscription state, and an
   AI outage or a lapsed subscription must never remove Course access. See
   [ADR 0002](0002-enrollment-as-canonical-entitlement.md).
3. **Disabled by default, with a kill switch.** Learner-facing AI is off unless
   explicitly enabled, and a single server-side switch disables it immediately
   without a deploy. The switch is exercised in a drill before AI is enabled
   for anyone.
4. **Quota, cost, and concurrency are accounted before the call.** Every
   request is attributed to a principal and checked against a limit before it
   reaches a provider. There is no unmetered path.
5. **Prompts and completions are never logged.** They join secrets, tokens,
   raw payment data, Journal and private Community content, and answer keys on
   the never-logged list in [CONTEXT.md](../../CONTEXT.md). Telemetry records
   correlation ids, token counts, latency, cost, and outcome, never content.
6. **Retrieval is authorization-scoped.** Any Course content an AI feature
   retrieves is filtered by the same entitlement the learner has for reading it
   directly. Ingestion never crosses a Course boundary the principal cannot
   cross.
7. **Grounded and attributed, or refused.** Learner-facing answers are grounded
   in retrieved Course content and cite it. An answer that cannot be grounded is
   refused rather than improvised, and no AI output modifies a Quiz, grade,
   completion, or Certificate without Faculty review.

## Consequences

- v1 carries no AI dependency, no AI cost, and no AI failure mode. The only v1
  cost is honouring the never-logged list and keeping the entitlement paths
  separate, both of which are required anyway.
- Wave 6 issues (#71 to #79) build against this seam rather than negotiating it
  per feature.
- Any pull request that imports a model vendor SDK outside the seam, logs a
  prompt, or couples AI entitlement to Course entitlement contradicts this
  record and is rejected.
- Evaluation, cost alerting, and abuse defences are prerequisites for enabling
  the feature, not follow-ups: #70, #72 to #75, #78, and the relevant gates in
  #79 must all be complete first.

## Alternatives considered

**Call a provider SDK directly from features.** Rejected: it scatters
credentials, quota, and logging decisions across the codebase, and makes
provider substitution and offline testing impossible.

**Treat AI as part of Course entitlement.** Rejected: it couples a paid
subscription to purchased Course access, so an AI billing failure would remove
access someone already paid for.

**Defer the decision entirely until Wave 6.** Rejected: the logging and
entitlement boundaries are being built now, in Waves 1 and 2, and are expensive
to revisit afterwards.

**Log prompts for debugging, redacted.** Rejected: prompts contain learner
questions about their own understanding, which is sensitive educational data,
and redaction is not reliable enough to justify the risk.

## Links

- [PRODUCT.md](../../PRODUCT.md#ai-pro), [CONTEXT.md](../../CONTEXT.md), [ADR 0002](0002-enrollment-as-canonical-entitlement.md)
- Issues [#70](https://github.com/akomapahealth/akomapa-lms/issues/70), [#71](https://github.com/akomapahealth/akomapa-lms/issues/71), [#72](https://github.com/akomapahealth/akomapa-lms/issues/72), [#78](https://github.com/akomapahealth/akomapa-lms/issues/78), [#79](https://github.com/akomapahealth/akomapa-lms/issues/79)
