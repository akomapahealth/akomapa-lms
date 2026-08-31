# 03. AI acceptable use and safety

- **Status:** Approved, with the clauses marked below still pending
- **Approver:** Prince Agyei Tuffour (@nanaagyei), 2026-08-30, under [#70](https://github.com/akomapahealth/akomapa-lms/issues/70)
- **Scope:** binds AI Pro before it may be enabled for anyone
- **Supporting artifacts:** [threat model](../ai/threat-model.md), [safety rubric](../ai/safety-rubric.md), [evaluation dataset](../../evals/README.md)

## Standing

AI Pro remains out of v1 scope. See
[PRODUCT.md](../../PRODUCT.md#ai-pro) and
[ADR 0006](../adr/0006-ai-provider-abstraction.md), now Accepted.

This policy was Proposed under issue #38 and is approved under #70, which
supplied the threat model, safety rubric, and versioned evaluation dataset that
justified approval. Approving it does not authorise building an AI feature: the
preconditions in the threat model's final section govern that, and all of them
are open.

## Rules

### Provider processing

1. All model access goes through the single provider seam in ADR 0006. No
   feature imports a vendor SDK directly. **No vendor is selected yet**:
   [#123](https://github.com/akomapahealth/akomapa-lms/issues/123).
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

13. **PENDING LEGAL REVIEW:** retention is 90 days for AI conversations,
    deleted on account deletion with no de-identified residue, and never used
    for training. The period is approved as product policy; its statutory
    sufficiency and the abuse-investigation need remain for legal review.
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

## Enforcement

Rules 7 to 11 are scored by the [safety rubric](../ai/safety-rubric.md) against
the [evaluation dataset](../../evals/README.md). Blocking dimensions require a
100% pass rate at the launch gate and at every model change. The dataset's
structure is validated in CI by `npm run test:evals`; the harness that executes
it against a provider is [#79](https://github.com/akomapahealth/akomapa-lms/issues/79).

## Still open

- **Provider selection.** No vendor is chosen: [#123](https://github.com/akomapahealth/akomapa-lms/issues/123).
- **Cost posture and spend thresholds.** No cost owner is named: [#124](https://github.com/akomapahealth/akomapa-lms/issues/124).
- **The clinical boundary in rubric dimension D3** and the bias matched pairs
  need review by a clinician or health educator: [#124](https://github.com/akomapahealth/akomapa-lms/issues/124).
- **AI conversation retention** is pending legal review.
