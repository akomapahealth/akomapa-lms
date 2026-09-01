# Operating policies

The policies that govern how Akomapa Academy handles personal data, AI, support,
moderation, and incidents. They are internal source-of-truth documents. The
learner-facing Privacy Policy and Terms of Service are generated from
`lib/legal-content.ts` and rendered at `/privacy` and `/terms`; where a policy
here changes what a learner is told, the public page is updated through the
follow-up issue named in that policy, not silently.

Approved by Prince Agyei Tuffour (@nanaagyei) on 2026-08-30 under issue
[#38](https://github.com/akomapahealth/akomapa-lms/issues/38), except where a
clause is marked **PENDING LEGAL REVIEW**. Those clauses are drafted, not
approved, and must not be encoded in product code or published to learners
until a qualified reviewer signs them off.

## Index

| Policy | Covers |
| --- | --- |
| [01 Data protection](01-data-protection.md) | Regulatory scope, controller and processor roles, the data inventory, lawful bases, data subject rights, international transfers |
| [02 Retention and deletion](02-retention-and-deletion.md) | The retention schedule for every store, account deletion, export, and the records that survive deletion |
| [03 AI acceptable use and safety](03-ai-acceptable-use-and-safety.md) | Rules that bind AI Pro before it may be enabled, including provider processing, grounding, refusal, and conversation retention. Enforced by the [safety rubric](../ai/safety-rubric.md) and [evaluation dataset](../../evals/README.md) |
| [04 Educational scope](04-educational-scope.md) | Not a clinic, not medical advice, no protected health information, and what happens when someone submits it anyway |
| [05 Support and service levels](05-support-and-service-levels.md) | Channels, hours, response targets, ownership, and what is explicitly not promised |
| [06 Incident response](06-incident-response.md) | Severity definitions, roles, timeline, regulatory notification duties, and the postmortem requirement |
| [07 Moderation and appeals](07-moderation-and-appeals.md) | Community standards, enforcement actions, the appeal path, and the audit trail |
| [08 Obligation to control map](08-obligation-to-control-map.md) | Every policy obligation mapped to the control, disclosure, runbook, or issue that satisfies it |

## Regulatory scope

Approved on 2026-08-30. These four regimes are in scope:

- **Ghana Data Protection Act, 2012 (Act 843).** The Akomapa Health Foundation
  operates from Accra and a significant share of learners are in West Africa.
- **United States state privacy law.** The Foundation is a US 501(c)(3) with a
  New Haven office. CCPA/CPRA-style access, deletion, and opt-out rights are
  honoured for any learner who asserts them, regardless of whether a threshold
  test is met.
- **GDPR and UK GDPR.** PRODUCT.md commits to a global and diaspora audience,
  which includes EEA and UK learners.
- **FERPA, as a voluntary standard.** **PENDING LEGAL REVIEW:** FERPA binds
  educational agencies and institutions that receive US Department of Education
  funding. Akomapa Academy is a nonprofit programme, not a funded institution,
  so FERPA most likely does not apply as law. It is adopted here as a voluntary
  practice standard for education records, and the applicability question is
  referred for review. If a US university partnership later makes the Academy a
  school official acting under an institution's control, this becomes a legal
  obligation and this policy set must be revised before that partnership
  starts.

Where regimes disagree, the strictest requirement applies to every learner
rather than segmenting the product by geography.

## How these policies bind

1. **A policy obligation without a control is not satisfied.** Policy 08 maps
   each obligation to the code, disclosure, runbook, or issue that implements
   it. An obligation with no control names the issue that will build one.
2. **No unapproved assumption reaches product code.** A clause marked PENDING
   LEGAL REVIEW may not be implemented, published, or relied on by a feature.
3. **Policies describe what is true, not what is aspirational.** Where a
   capability does not exist, the policy says so and names the issue. Email
   notification, telemetry beyond platform logs, and scheduled background
   processing do not exist today; see policy 05 and policy 08.
4. **Changing a policy needs an approver.** Record the name and date in the
   policy's approval block. Changing a learner-facing commitment also requires
   updating `lib/legal-content.ts` and bumping `siteConfig.legalEffectiveDate`.

## Status

| Policy | Status |
| --- | --- |
| 01 Data protection | Approved, with marked clauses pending legal review |
| 02 Retention and deletion | Approved, with retention minimums pending legal review |
| 03 AI acceptable use and safety | Approved under [#70](https://github.com/akomapahealth/akomapa-lms/issues/70), with provider selection, cost posture, the clinical boundary, and conversation retention still open. AI Pro remains out of v1 scope |
| 04 Educational scope | Approved |
| 05 Support and service levels | Approved |
| 06 Incident response | Approved, with notification deadlines pending legal review |
| 07 Moderation and appeals | Approved |
| 08 Obligation to control map | Approved |
