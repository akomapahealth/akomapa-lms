# 03. AI acceptable use and safety

- **Status:** **Proposed.** Not approved, and not implementable
- **Approver:** pending, gated on [#70](https://github.com/akomapahealth/akomapa-lms/issues/70)
- **Scope:** binds AI Pro before it may be enabled for anyone

## Standing

AI Pro is out of v1 scope. See
[PRODUCT.md](../../PRODUCT.md#ai-pro) and
[ADR 0006](../adr/0006-ai-provider-abstraction.md), which is itself Proposed.

This policy exists so that the privacy, retention, and safety obligations of an
AI feature are written down **before** the boundaries that must satisfy them
are built in Waves 1 and 2. It is deliberately not approved: the threat model,
safety rubric, and evaluation dataset that would justify approval are the
deliverable of #70. Nothing here may be implemented, published, or relied on
until #70 closes and an approver is recorded above.

## Rules proposed

### Provider processing

1. All model access goes through the single provider seam in ADR 0006. No
   feature imports a vendor SDK directly.
2. The provider is a **processor**, not a controller, under a data processing
   agreement executed before any learner data reaches it.
3. **No training on Academy data.** The contract must prohibit the provider
   from using prompts, completions, or retrieved Course content to train or
   improve models. If a provider cannot commit to this, it is not eligible.
4. The provider, its processing regions, and its retention are disclosed in the
   public privacy page and added to the inventory in
   [policy 01](01-data-protection.md) before the feature is enabled.

### What may and may not be sent

5. Only the learner's own prompt and Course content that learner is already
   entitled to read may be sent. Retrieval is scoped by the same entitlement
   as direct reading, per [ADR 0002](../adr/0002-enrollment-as-canonical-entitlement.md).
6. **Never sent to a provider:** Journal Entry content, private Community
   content, answer keys, other learners' data, payment data, and identity data
   beyond an opaque correlation id.

### Behaviour

7. **Grounded or refused.** A learner-facing answer is grounded in retrieved
   Course content and cites it. An answer that cannot be grounded is refused,
   not improvised.
8. **Uncertainty is stated,** not smoothed over.
9. **Individual clinical guidance is refused,** with a redirect to Course
   material and to a qualified human. This inherits
   [policy 04](04-educational-scope.md) and is a launch gate, not a quality
   target.
10. **No assessment authority.** AI output never sets or alters a Quiz score,
    grade, completion, Badge, or Certificate. Generated Quiz variants require
    Faculty review before a learner sees them.
11. **No answer leakage.** An AI feature must not reveal `isCorrect` data or
    the answer to an assessment the learner has not submitted.

### Acceptable use by learners

12. Prohibited: attempting to extract answer keys or other learners' data;
    prompt injection or jailbreak attempts; seeking individualised medical
    advice; generating harmful, harassing, or academically dishonest content;
    and automated or bulk access. Enforcement follows
    [policy 07](07-moderation-and-appeals.md).

### Retention of conversations

13. **PENDING LEGAL REVIEW and #70:** proposed retention is 90 days for AI
    conversations, deleted on account deletion with no de-identified residue,
    and never used for training. Confirm against the abuse-investigation need
    before adoption.
14. Prompts and completions are never logged. Telemetry records correlation
    id, token counts, latency, cost, and outcome only, per
    [policy 01](01-data-protection.md).

### Operations

15. Quota, cost, and concurrency are checked before a call reaches a provider.
    There is no unmetered path.
16. A single server-side kill switch disables learner-facing AI immediately
    without a deploy, and is exercised in a drill before AI is enabled for
    anyone.
17. Learner-facing AI is disabled by default and stays disabled until #70, #72
    to #75, #78, and the relevant evaluation gates in #79 are all complete.
18. An AI outage or a lapsed AI subscription never removes Course access.

## What #70 must add before this can be approved

The threat model (prompt injection, cross-Course retrieval, sensitive-data
leakage, tool misuse, answer leakage, abuse, billing bypass, provider
compromise); the educational safety rubric with pass thresholds; the versioned,
de-identified evaluation dataset with expected citations and refusals; the
named owners of launch thresholds, escalation, model-change review, and the
kill switch; and the cost posture.
