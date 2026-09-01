# 0006. Put AI behind a provider seam with a kill switch

- **Status:** Accepted
- **Date:** 2026-08-30
- **Approver:** Prince Agyei Tuffour (@nanaagyei)
- **Implemented by:** [#71](https://github.com/akomapahealth/akomapa-lms/issues/71)
- **Supporting artifacts:** [threat model](../ai/threat-model.md), [safety rubric](../ai/safety-rubric.md), [evaluation dataset](../../evals/README.md), [policy 03](../policies/03-ai-acceptable-use-and-safety.md)

## Context

This record was Proposed under issue #36 and is accepted under
[#70](https://github.com/akomapahealth/akomapa-lms/issues/70), which supplies
the threat model, safety rubric, and versioned evaluation dataset that
justified acceptance.

AI Pro remains **out of v1 scope**. No AI feature ships in the v1.0.0 release.
This record fixes the seam now because Waves 1 and 2 are building the
entitlement, logging, and retrieval boundaries that a later AI feature must
satisfy, and retrofitting them would be expensive.

Accepting the seam is not approval to build a feature. The preconditions in the
threat model's final section govern that, and all of them are open.

## Decision

### Provider

**No vendor is selected by this record.** #70's brief presumed an OpenAI-first
seam; that presumption is not carried forward, because the seam's value is that
it makes the choice reversible, and locking a vendor in the same record that
creates the abstraction would waste it. Provider selection is an explicit open
decision, [#123](https://github.com/akomapahealth/akomapa-lms/issues/123), and #71's title presumes an answer it does not
have.

The seam must be satisfiable by more than one vendor. A design that only works
with one provider's proprietary feature has failed this record.

### Provider responsibilities

The seam owns, and no feature may reimplement: credential handling; model class
selection; request assembly, including the redaction allowlist; structured
output validation; timeout, retry, and backoff; quota, cost, and concurrency
accounting before the call; the kill switch; and telemetry that records
correlation id, token counts, latency, cost, and outcome but never content.

A feature calling the seam supplies a principal, a task type, and its inputs.
It receives a validated result or a typed failure. It never sees a raw provider
response.

### Model and configuration selection

1. **Select by class, not by name.** Features request a capability class,
   currently `reasoning` for grounded tutoring and `fast` for short
   classification. The mapping from class to a concrete model and its
   configuration lives in one place in the seam.
2. **Pin exactly, and record it.** The concrete model id, its version, and the
   full generation configuration are pinned. Floating aliases that a provider
   can repoint are prohibited: a model that changes under you invalidates every
   evaluation you have run.
3. **Any change re-runs the dataset.** A provider change, model change,
   configuration change, or prompt change is a **model change** under the
   [safety rubric](../ai/safety-rubric.md) and must meet the model-change gate
   before it reaches learners.
4. **Provider documentation is authoritative over recollection.** Model names,
   context limits, and pricing are read from the provider's current
   documentation at selection time, never from memory.

### Structured output

5. All model output is requested and parsed as a **schema-validated structure**,
   never free-form prose that a feature parses itself. The schema carries the
   answer, its citations, and an explicit grounding and uncertainty signal.
6. **Validation failure discards.** Invalid output is not repaired, not
   partially used, and not shown. Retry once, then fail to the unavailable
   state.
7. The schema is versioned with the prompt that produces it.

### Retrieval and citation contract

8. **Retrieval is authorization-scoped.** The corpus is restricted to content
   the principal may already read, by the entitlement API of
   [ADR 0002](0002-enrollment-as-canonical-entitlement.md), running under the
   transaction-scoped principal of
   [ADR 0003](0003-rls-and-transaction-scoped-principal.md).
9. **Assessment content and answer keys are never indexed.** Exclusion from the
   corpus is the control; refusal behaviour is secondary.
10. **Journal Entries and private Community content are never indexed**, under
    any setting.
11. **Every citation is verified server-side** to resolve to content the
    principal may read, before the answer is returned. An unresolvable or
    unpermitted citation invalidates the entire answer, not just the citation.
12. **Ungrounded means refused.** If retrieval returns nothing permitted, the
    feature refuses and says so. It never answers from model memory.
13. Retrieval implementation, including the vector index, is
    [#74](https://github.com/akomapahealth/akomapa-lms/issues/74). This record
    fixes the contract, not the index technology.

### Entitlement

14. **AI entitlement is separate from Course entitlement**, and neither reads
    the other. An AI outage or a lapsed AI subscription must never remove
    Course access someone paid for. Reconciliation is
    [#72](https://github.com/akomapahealth/akomapa-lms/issues/72).

### Storage and retention

15. **Prompts and completions are never logged.** See
    [policy 01](../policies/01-data-protection.md).
16. Stored AI conversations, if a feature stores them, follow the retention
    period in [policy 03](../policies/03-ai-acceptable-use-and-safety.md), are
    deleted on account deletion with no de-identified residue, and are never
    used for training.
17. The provider is a processor under an executed DPA with a no-training
    commitment, added to the inventory in policy 01 and disclosed on the public
    privacy page before the feature is enabled.

### Failure modes

The safe state is always "no AI answer", never "an answer we are unsure about".
The full table is in the [threat model](../ai/threat-model.md); the binding
summary: provider unavailable, malformed output, empty permitted retrieval,
unresolvable citation, quota exceeded, and missing or stale entitlement all
resolve to a refusal or an honest unavailable state. None fabricates.

### Kill switch

18. A single server-side switch disables learner-facing AI immediately without
    a deploy. Any Administrator may pull it without approval. It is **drilled
    before launch**, and an undrilled kill switch is not a control. Ownership
    and restore criteria are in the threat model.

### Assessment authority

19. AI output never sets or alters a Quiz score, grade, completion, Badge, or
    Certificate. Generated Quiz variants require Faculty review before any
    learner sees them.

## Consequences

- v1 carries no AI dependency, cost, or failure mode. The only v1 obligations
  are the never-logged list and keeping the two entitlement paths separate,
  both required anyway.
- Wave 6 builds against this seam rather than renegotiating it per feature.
- A pull request that imports a vendor SDK outside the seam, logs a prompt,
  couples AI entitlement to Course entitlement, uses a floating model alias, or
  ships an answer with an unverified citation contradicts this record and is
  rejected.
- Evaluation becomes a release gate rather than a quality report. A model
  change that cannot meet the blocking gate does not roll out, whatever it
  saves.
- Pinning models and re-running evaluations makes provider changes slower and
  more deliberate. That is the intended trade.

## Alternatives considered

**Lock OpenAI now, as #70's brief assumed.** Rejected: it spends the seam's
main benefit at the moment of creating it, and the selection criteria (safety
performance against this dataset, DPA and no-training terms, cost, regional
availability) cannot be evaluated before the dataset exists and the cost owner
is named. Deferred to [#123](https://github.com/akomapahealth/akomapa-lms/issues/123) and [#124](https://github.com/akomapahealth/akomapa-lms/issues/124).

**Call a provider SDK directly from features.** Rejected: scatters credentials,
quota, and logging decisions, and makes provider substitution and offline
testing impossible.

**Treat AI as part of Course entitlement.** Rejected: an AI billing failure
would remove access someone already paid for.

**Free-form prose output parsed per feature.** Rejected: unparseable output
becomes a silent partial answer, and citation verification has nothing reliable
to verify.

**Prompt-based isolation between Courses.** Rejected outright: an instruction
is not an access control. See threat model T3.

**Defer the whole decision to Wave 6.** Rejected: the logging and entitlement
boundaries are being built now and are expensive to revisit.

## Links

- [Threat model](../ai/threat-model.md), [safety rubric](../ai/safety-rubric.md), [evaluation dataset](../../evals/README.md)
- [PRODUCT.md](../../PRODUCT.md#ai-pro), [CONTEXT.md](../../CONTEXT.md), [policy 03](../policies/03-ai-acceptable-use-and-safety.md)
- [ADR 0002](0002-enrollment-as-canonical-entitlement.md), [ADR 0003](0003-rls-and-transaction-scoped-principal.md)
- Issues [#70](https://github.com/akomapahealth/akomapa-lms/issues/70), [#71](https://github.com/akomapahealth/akomapa-lms/issues/71), [#72](https://github.com/akomapahealth/akomapa-lms/issues/72), [#74](https://github.com/akomapahealth/akomapa-lms/issues/74), [#78](https://github.com/akomapahealth/akomapa-lms/issues/78), [#79](https://github.com/akomapahealth/akomapa-lms/issues/79)
