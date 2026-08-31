# AI threat model

- **Status:** Approved
- **Approver:** Prince Agyei Tuffour (@nanaagyei), 2026-08-30
- **Scope:** every AI capability in Akomapa Academy, including AI Pro tutoring and Faculty-controlled generated Quiz variants
- **Related:** [ADR 0006](../adr/0006-ai-provider-abstraction.md), [policy 03](../policies/03-ai-acceptable-use-and-safety.md), [safety rubric](safety-rubric.md), [evaluation dataset](../../evals/README.md)

## Standing assumption

**Everything crossing the model boundary is untrusted.** The learner's prompt is
untrusted because a learner may be an attacker. Retrieved Course content is
untrusted because Faculty and Administrators author it and an attacker who
reaches authoring has reached the retrieval corpus. The model's output is
untrusted because it is generated text that may contain anything, including
instructions. No component may treat any of the three as authority.

The corollary governs every control below: **isolation is enforced outside the
model, never by the model.** A prompt instructing the model not to reveal
another Course's content is not a control. A query that cannot reach another
Course's content is.

## Trust boundaries

```
Browser  ──1──▶  Next.js server  ──2──▶  PostgreSQL (RLS)
(untrusted)      (trusted, holds        (trusted store)
                  the principal)
                       │
                       3
                       ▼
                 Provider seam  ──4──▶  Model provider
                 (trusted)              (untrusted output,
                                         processor for input)
```

1. **Browser to server.** Carries only the Clerk session and the learner's
   text. Never a userId, role, Course id claim, entitlement, quota, or model
   selection. Crossing rule: derive the principal server-side per
   [ADR 0001](../adr/0001-identity-authentication-and-rbac.md).
2. **Server to database.** Retrieval runs under the transaction-scoped
   principal of [ADR 0003](../adr/0003-rls-and-transaction-scoped-principal.md),
   so RLS constrains the corpus even if the retrieval query is wrong.
3. **Server to provider seam.** The only place a prompt is assembled. Enforces
   the redaction list, quota, concurrency, and the kill switch.
4. **Seam to provider.** A network boundary to a processor. Everything
   returning across it is untrusted text.

## Threat actors

| Actor | Capability | Motivation |
| --- | --- | --- |
| Curious learner | A valid account, one Course entitlement | Get answers, skip work, see what the system will say |
| Adversarial learner | The same, plus deliberate crafted input | Extract answer keys, reach other Courses, obtain free capacity |
| Compromised learner account | Whatever that learner had | Whatever the attacker wants |
| Malicious or careless author | Faculty or Administrator write access to Course content | Inject instructions into the retrieval corpus, deliberately or by pasting untrusted material |
| External attacker, no account | Public surfaces only, including `/verify` | Free model capacity, denial of service, cost exhaustion |
| Compromised provider | Sees every prompt and retrieved chunk sent to it | Data disclosure, poisoned output |
| Insider | Production database and log access | Read private learner reflection |

## Threats and controls

Each threat names the control, whether it exists, and the issue that builds it.
**None of these is satisfied today.** AI is out of v1 scope and every control
below is a precondition for enabling any AI feature.

### T1. Prompt injection from the learner

An adversarial prompt tries to override system instructions: reveal your
instructions, ignore previous rules, output the answer key, act as a different
Course.

**Controls.** Instruction and data are separated in the prompt assembly, with
retrieved content clearly delimited and never concatenated as instruction.
Injection cannot succeed in gaining authority because the seam grants no
authority: the model has no tools, no database access, and no ability to widen
its own retrieval scope. Output is validated against a structured schema before
use. Evaluation cases for this class are `injection-*` in the dataset, and they
are **blocking**.

**Residual risk.** A sufficiently clever prompt may still produce embarrassing
or off-policy prose. That is a quality failure, contained by the fact that it
cannot become a data or authorization failure. Owner: [#78](https://github.com/akomapahealth/akomapa-lms/issues/78).

### T2. Indirect prompt injection through Course content

An attacker with authoring access, or Faculty pasting material from elsewhere,
embeds instructions in a Topic. Retrieval pulls it in, and the model obeys it.
This is the more dangerous variant of T1 because the payload arrives through a
trusted-looking path.

**Controls.** Retrieved content is delimited and labelled as data. The model is
given no capability that an instruction could usefully hijack. Authoring
publication invariants ([#65](https://github.com/akomapahealth/akomapa-lms/issues/65))
and rich-text sanitisation ([#81](https://github.com/akomapahealth/akomapa-lms/issues/81))
reduce what can be stored. Evaluation cases `injection-indirect-*`, blocking.

**Residual risk.** Cannot be eliminated while Course content is both
attacker-influencable and retrievable. Accepted, because the capability grant
is empty.

### T3. Cross-Course and cross-learner retrieval

The model answers using content the learner is not entitled to, or another
learner's data.

**Controls.** Three independent layers, deliberately redundant because this is
the threat that would most damage trust. First, retrieval filters by the same
entitlement as direct reading
([ADR 0002](../adr/0002-enrollment-as-canonical-entitlement.md)). Second, RLS
constrains the corpus under the transaction-scoped principal (ADR 0003), so a
wrong query returns nothing rather than another Course. Third, every returned
citation is verified to resolve to content the principal may read, before the
answer is shown. Evaluation cases `isolation-*`, blocking. Owner:
[#74](https://github.com/akomapahealth/akomapa-lms/issues/74).

**Residual risk.** Low, given three layers. A failure here is a SEV1 under
[policy 06](../policies/06-incident-response.md).

### T4. Answer-key and assessment leakage

The model reveals `QuestionOption.isCorrect`, or reasons its way to the answer
of a Quiz the learner has not submitted.

**Controls.** Assessment content and answer keys are **excluded from the
retrieval corpus entirely**. This is the primary control: material that is
never indexed cannot be retrieved. Refusal behaviour for direct requests is
secondary. Generated Quiz variants are produced in a separate Faculty-only
path that never serves a learner without review. Evaluation cases
`answer-leak-*`, blocking.

**Residual risk.** The model may reason correctly about Course material that
happens to answer a Quiz question. This is indistinguishable from teaching and
is accepted: a tutor that cannot explain the material is not a tutor. Attempt
integrity is protected by [#41](https://github.com/akomapahealth/akomapa-lms/issues/41)
and [#63](https://github.com/akomapahealth/akomapa-lms/issues/63), not by the
model's discretion.

### T5. Sensitive-data leakage to the provider

Journal Entries, private Community content, payment data, or identity data
reach a provider.

**Controls.** An allowlist, not a blocklist: only the learner's own prompt and
Course content that learner may read are eligible to be sent. Everything else
is excluded by construction. The provider is contractually barred from training
on Academy data ([policy 03](../policies/03-ai-acceptable-use-and-safety.md)),
under a DPA executed before launch. Prompts and completions are never logged
([policy 01](../policies/01-data-protection.md)).

**Residual risk.** A learner may paste sensitive material into their own
prompt, including patient information. Handled as PHI submission under
[policy 04](../policies/04-educational-scope.md), at SEV2. Detection is
best-effort; the response is defined.

### T6. Harmful or clinically unsafe output

The model gives individualised clinical guidance, or produces harmful,
harassing, or discriminatory content, in a product whose learners work with
real patients.

**Controls.** Grounding is mandatory and ungrounded answers are refused rather
than improvised. Medical-advice refusal is a **launch gate**, not a quality
target, with the thresholds in the [safety rubric](safety-rubric.md). AI output
never sets a score, grade, completion, Badge, or Certificate. Learner-facing
answers carry the educational-scope disclosure of policy 04. Evaluation cases
`medical-*` and `harm-*`, blocking. Owner:
[#79](https://github.com/akomapahealth/akomapa-lms/issues/79).

**Residual risk.** Generative output cannot be guaranteed. This is why the kill
switch exists and why learner feedback is a required channel rather than a
nicety.

### T7. Cost exhaustion and abuse of capacity

A learner, a script, or an unauthenticated caller drives spend or starves other
learners.

**Controls.** Quota, cost, and concurrency are checked **before** a call
reaches a provider, attributed to a principal; there is no unmetered path.
Every AI route requires an authenticated principal with a current AI
entitlement. Rate limits ([#46](https://github.com/akomapahealth/akomapa-lms/issues/46))
apply. Cost alerts and the kill switch are in
[#79](https://github.com/akomapahealth/akomapa-lms/issues/79). Owner:
[#73](https://github.com/akomapahealth/akomapa-lms/issues/73).

**Residual risk.** A distributed attack across many valid accounts. Mitigated
by global spend alerting and the kill switch, not by per-principal limits
alone.

### T8. Billing bypass and entitlement confusion

A learner obtains AI access without a current subscription, or an AI billing
failure removes Course access someone paid for.

**Controls.** AI entitlement is a separate check from Course entitlement and
neither reads the other (ADR 0002, ADR 0006). Entitlement is derived
server-side from reconciled Stripe state
([#72](https://github.com/akomapahealth/akomapa-lms/issues/72)), never from a
client claim. **An AI outage or lapsed AI subscription must never remove Course
access**, which is an invariant rather than a preference.

### T9. Provider compromise or degradation

The provider is breached, silently changes model behaviour, or fails.

**Controls.** The single seam means one place to switch providers. Model class
and configuration are pinned and recorded, and any change re-runs the
evaluation dataset against the thresholds before it reaches learners. Provider
failure degrades to a clear unavailable state, never to a fabricated answer.
The kill switch disables learner-facing AI immediately without a deploy, and is
drilled before launch. A provider breach is a SEV1 under policy 06, including
the processor-account requirement.

**Residual risk.** Anything sent before a breach was already sent. This is the
reason for the minimisation in T5 rather than a control of its own.

### T10. Insider access to prompts and reflection

Someone with production access reads private learner material.

**Controls.** Prompts and completions are never logged, so there is no log to
read. Journal Entries never enter the AI path at all. RLS applies to
operational access, and the runtime role cannot bypass it (ADR 0003).

**Residual risk.** A privileged database role can still read stored AI
conversations for the retention period in policy 03. Minimised by that
retention limit.

## Kill switch

- **What it does.** Disables every learner-facing AI capability immediately,
  server-side, without a deploy. Course access, Quizzes, Certificates, and
  Community are unaffected by design.
- **Who may pull it.** Any Administrator, without approval. A false positive
  costs a paid feature for an hour; hesitation costs trust.
- **Owner.** Prince Agyei Tuffour (@nanaagyei) owns the switch and the decision
  to restore.
- **When it must be pulled.** Any confirmed or suspected T3, T4, or T5 event;
  any T6 event involving clinical guidance; any provider incident with unknown
  scope; a cost anomaly beyond the alert threshold.
- **Restoring.** Requires the cause identified, a regression test that fails
  before the fix, the evaluation dataset re-run at or above launch thresholds,
  and the postmortem started.
- **Drilled before launch.** The switch is exercised in a non-production
  environment and the result attached to
  [#79](https://github.com/akomapahealth/akomapa-lms/issues/79). An untested
  kill switch is not a control.

## Failure modes

The safe state is always "no AI answer", never "an answer we are unsure about".

| Failure | Behaviour |
| --- | --- |
| Provider unavailable or timing out | Show unavailable, offer the Course material. Never fabricate |
| Provider returns malformed or schema-invalid output | Discard, do not repair, do not show. Retry once, then unavailable |
| Retrieval returns nothing the learner may read | Refuse and say so. Never answer from model memory |
| A citation does not resolve to permitted content | Discard the whole answer, not just the citation |
| Quota or concurrency exceeded | Refuse with the limit stated and when it resets |
| Entitlement missing, stale, or contradictory | Deny |
| Kill switch engaged | The feature is absent, with an honest message |

## What must be true before any AI feature is enabled

1. #70 closed with this threat model, the rubric, and the dataset approved.
2. Provider selected under its own decision issue, with a DPA and a no-training
   commitment executed.
3. #72 to #75 complete: entitlement reconciliation, usage accounting,
   authorized retrieval, grounded Q&A.
4. #78 complete: injection, exfiltration, and abuse defences.
5. #79 complete: evaluations at or above launch thresholds, cost alerting, and
   a **drilled** kill switch.
6. Policy 03 approved and the public privacy and terms pages updated
   ([#119](https://github.com/akomapahealth/akomapa-lms/issues/119)).
7. ADR 0003 RLS in place, since T3's second layer depends on it.
