# AI evaluation dataset

The versioned, de-identified dataset that gates every AI capability in Akomapa
Academy, and the structural validator that keeps it honest.

- **Dataset:** `dataset.v1.jsonl`, version 1.0.0, 43 cases
- **Thresholds:** `thresholds.json`, machine-readable, mirrors the rubric
- **Validator:** `dataset.test.mjs`, run with `npm run test:evals`
- **Rubric:** [docs/ai/safety-rubric.md](../docs/ai/safety-rubric.md)
- **Threat model:** [docs/ai/threat-model.md](../docs/ai/threat-model.md)
- **Approver:** Prince Agyei Tuffour (@nanaagyei), 2026-08-30

## What this is and is not

This is the **dataset and its structural validation**. It does not call a model.

The harness that executes these cases against a provider and scores the
responses is [#79](https://github.com/akomapahealth/akomapa-lms/issues/79); the
provider seam it runs through is
[#71](https://github.com/akomapahealth/akomapa-lms/issues/71). Neither exists
yet, and no AI feature ships in v1.

What runs in CI today is `npm run test:evals`, which proves the dataset is well
formed, complete against every rubric dimension, internally consistent with the
thresholds, and free of the failure mode where a dataset only contains refusal
cases. That last check matters: a dataset with no cases that **must** be
answered would give a passing grade to a model that refuses everything, which
the rubric explicitly scores as a failure.

## Case shape

```json
{
  "id": "medical-001",
  "category": "medical_advice",
  "dimension": "D3",
  "class": "blocking",
  "prompt": "...",
  "context": "course:community-health",
  "expect": "refuse",
  "expect_citations": false,
  "forbidden": ["drug name", "dose", "route", "management plan"],
  "rationale": "..."
}
```

| Field | Meaning |
| --- | --- |
| `id` | Unique, stable. Referenced from the threat model and by incident postmortems |
| `category` | The threat or quality family. One of eleven |
| `dimension` | The rubric dimension D1 to D7 this case scores |
| `class` | `blocking` (any failure blocks release) or `quality` (scored in aggregate) |
| `context` | Synthetic Course, Topic, entitlement, and failure-injection state. Never real data |
| `expect` | The required behaviour: `answer`, `refuse`, `partial`, `hedge`, `scoped_answer`, `correct_premise`, or `unavailable` |
| `expect_citations` | Whether the response must carry resolvable citations |
| `forbidden` | Content that must not appear. The scorer's deny list for this case |
| `rationale` | Why the case exists. A case nobody can justify gets deleted, not kept |
| `pair_id`, `pair_variant` | Bias cases only. Matched pairs differing in exactly one attribute |

## Coverage

43 cases: 33 blocking, 10 quality.

| Category | Cases | Maps to |
| --- | --- | --- |
| `groundedness` | 5 | D1, baseline and out-of-corpus behaviour |
| `citation` | 3 | D2, including a fabricated-reference trap |
| `isolation` | 4 | D5, threat T3 cross-Course and cross-learner |
| `answer_leakage` | 3 | D5, threat T4, including a live-attempt case |
| `injection` | 4 | D1/D2/D5, threats T1 and T2, direct and indirect |
| `medical_advice` | 5 | D3, threat T6, refusal **and** over-refusal |
| `harm` | 4 | D4, including the defensive mirror of a harmful request |
| `uncertainty` | 3 | D6, including a case where hedging is itself the failure |
| `usefulness` | 3 | D7, including a refusal that must still teach |
| `bias` | 4 | Two matched pairs: cadre and setting, gender |
| `failure_mode` | 5 | Empty retrieval, provider timeout, malformed output, unresolvable citation, expired entitlement |

## De-identification

Every case is synthetic. No real learner, patient, Course, Topic, or
Certificate appears. Clinical scenarios are constructed and carry only the
detail the case needs. The `context` field names synthetic Course and Topic
slugs that the harness maps onto fixtures, never onto production data.

**No production data may ever enter this dataset.** A case derived from a real
learner interaction is rewritten into a synthetic equivalent before it is
added, and the original is not stored.

## Versioning

The dataset is versioned in its filename and in `thresholds.json`.

- **Patch** (1.0.x): a rationale reworded, a typo fixed. No case added, removed,
  or changed in expected behaviour.
- **Minor** (1.x.0): cases added. Existing expectations unchanged.
- **Major** (x.0.0): a case's expected behaviour changed, or a case removed.
  A new file, `dataset.v2.jsonl`, is added rather than the old one edited, so
  historical evaluation runs stay reproducible.

Changing an expectation is a rubric change and needs the approver named above.

## Adding a case

1. Write it from a real threat or a real failure, and put that in `rationale`.
2. Pick the dimension first; `class` follows from it and the validator enforces
   the correspondence.
3. If the case tests a refusal, check the category still has a counter-case
   that must be answered. Over-refusal is a rubric failure.
4. Run `npm run test:evals`.
5. Bump the version per the rules above.

Every failure found in production becomes a case here as part of the
postmortem, per [policy 06](../docs/policies/06-incident-response.md).
