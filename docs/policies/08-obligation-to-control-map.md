# 08. Obligation to control map

- **Status:** Approved
- **Approver:** Prince Agyei Tuffour (@nanaagyei), 2026-08-30

Every obligation these policies create, mapped to the thing that satisfies it.
An obligation whose control is an issue is **not yet satisfied**, and that is
stated rather than implied.

Legend: **Code** an implemented control; **Disclosure** learner-facing text;
**Runbook** a documented manual procedure; **Issue** not yet built; **Legal**
awaiting review.

## Identity, access, and authorization

| Obligation | Type | Control |
| --- | --- | --- |
| Only the account owner and authorised staff may read a learner's records | Code | Server-derived principal, [ADR 0001](../adr/0001-identity-authentication-and-rbac.md); `proxy.ts`, `lib/auth/` |
| Access decisions cannot be forged from the browser | Code | ADR 0001 invariants; [CONTEXT.md](../../CONTEXT.md) |
| A missing authorization check must not disclose data | Issue | RLS second layer, [ADR 0003](../adr/0003-rls-and-transaction-scoped-principal.md), [#43](https://github.com/akomapahealth/akomapa-lms/issues/43) |
| Course access is granted only by entitlement | Code, Issue | [ADR 0002](../adr/0002-enrollment-as-canonical-entitlement.md); [#48](https://github.com/akomapahealth/akomapa-lms/issues/48) |
| Role grants are not made by environment variable | Issue | Retire `TEACHER_ID`, [#42](https://github.com/akomapahealth/akomapa-lms/issues/42) |
| Faculty and Administrator capabilities are separated | Issue | [#86](https://github.com/akomapahealth/akomapa-lms/issues/86) |

## Confidentiality of sensitive content

| Obligation | Type | Control |
| --- | --- | --- |
| Journal Entries are never logged, exported to analytics, or staff-visible while private | Code, Runbook | Never-logged list, [policy 01](01-data-protection.md), CONTEXT.md invariants |
| Answer keys never reach a client pre-submission and are never logged | Code, Issue | CONTEXT.md invariants; Quiz binding [#41](https://github.com/akomapahealth/akomapa-lms/issues/41) |
| No secrets, tokens, or raw payment data in logs | Code | `lib/logger.ts` logs tag and message only in production; gitleaks and the secret scan in CI |
| Redacted structured logging with correlation ids | Issue | [#102](https://github.com/akomapahealth/akomapa-lms/issues/102) |

## Data subject rights

| Obligation | Type | Control |
| --- | --- | --- |
| Right of access, rectification, erasure, restriction, portability, objection | Runbook | Manual process, [policy 01](01-data-protection.md). Requests via `siteConfig.contactUrl` |
| Identity verified before disclosure or deletion | Runbook | Verified against the Clerk account |
| Acknowledge in 5 working days, complete in 30 | Runbook | [policy 05](05-support-and-service-levels.md) targets |
| Self-service account deletion and export | Issue | [#117](https://github.com/akomapahealth/akomapa-lms/issues/117). No self-service flow exists today |
| Learner administration including suspension and deletion | Issue | [#88](https://github.com/akomapahealth/akomapa-lms/issues/88) |
| Confirm the shortest statutory response deadline across regimes | **Legal** | Pending review, [policy 01](01-data-protection.md) |

## Retention and deletion

| Obligation | Type | Control |
| --- | --- | --- |
| A named retention period for every data class | Runbook | Schedule in [policy 02](02-retention-and-deletion.md) |
| Automatic enforcement of retention periods | Issue | [#118](https://github.com/akomapahealth/akomapa-lms/issues/118). No scheduled job and no `vercel.json` cron exist today |
| Retention, cascades, and concurrency correct at the database layer | Issue | [#51](https://github.com/akomapahealth/akomapa-lms/issues/51) |
| Public page states real periods, not "a reasonable period" | Issue | [#119](https://github.com/akomapahealth/akomapa-lms/issues/119). Update `lib/legal-content.ts` and bump `siteConfig.legalEffectiveDate` |
| Confirm the financial retention minimum and the deletion grace period | **Legal** | Pending review, [policy 02](02-retention-and-deletion.md) |
| Certificates survive account deletion, and revocation is the alternative | Disclosure, Issue | Disclosed in policy 02. Revocation is not implemented: [#120](https://github.com/akomapahealth/akomapa-lms/issues/120) |

## Payments

| Obligation | Type | Control |
| --- | --- | --- |
| No card data reaches Akomapa systems | Code | Stripe Checkout; only `stripeCustomerId` and `Purchase` are stored |
| Payment taken always results in access | Issue | Idempotent reconciliation, [#54](https://github.com/akomapahealth/akomapa-lms/issues/54); outbox [ADR 0005](../adr/0005-transactional-outbox-processing.md), [#69](https://github.com/akomapahealth/akomapa-lms/issues/69) |
| Exact money representation | Issue | [#55](https://github.com/akomapahealth/akomapa-lms/issues/55). `Course.price` is currently a float |
| Refund removes access without deleting payment evidence | Runbook, Issue | ADR 0002 states the rule; refund handling to be built with [#114](https://github.com/akomapahealth/akomapa-lms/issues/114) |

## Educational scope

| Obligation | Type | Control |
| --- | --- | --- |
| Not a clinic, not medical advice | Disclosure | Notices on `/privacy` and `/terms` via `lib/legal-content.ts` |
| No identifiable patient information submitted | Disclosure, Runbook | [policy 04](04-educational-scope.md); handled as SEV2 under policy 06 |
| Certificates are not a licence or accreditation | Disclosure | `/terms` certificates section; policy 04 |
| Case Studies use constructed or de-identified scenarios | Runbook | Faculty responsibility, policy 04; authoring [#87](https://github.com/akomapahealth/akomapa-lms/issues/87) |

## Moderation

| Obligation | Type | Control |
| --- | --- | --- |
| Community standards published | Disclosure | `/terms` acceptable use |
| Proportionate, notified, appealable actions | Runbook | [policy 07](07-moderation-and-appeals.md) |
| Consolidated audit trail and reversible actions | Issue | [#89](https://github.com/akomapahealth/akomapa-lms/issues/89). Manual until then |
| Community suspension does not remove paid Course access | Code, Runbook | Separate `Enrollment.status`, ADR 0002 |
| Rich-text content cannot carry script injection | Issue | [#81](https://github.com/akomapahealth/akomapa-lms/issues/81) |

## Support

| Obligation | Type | Control |
| --- | --- | --- |
| Single support channel and published targets | Disclosure | [policy 05](05-support-and-service-levels.md); `siteConfig.contactUrl` |
| Named escalation contact | Runbook | Policy 05 |
| Do not imply email notification that cannot be sent | Issue | [#121](https://github.com/akomapahealth/akomapa-lms/issues/121). `UserSettings.emailOn*` flags have no delivery mechanism; no email provider is installed |

## Incident response

| Obligation | Type | Control |
| --- | --- | --- |
| Severity definitions, roles, timeline, postmortem | Runbook | [policy 06](06-incident-response.md) |
| 72 hour authority notification | Runbook, **Legal** | Policy 06; shortest applicable deadline pending review |
| Detect incidents rather than wait for reports | Issue | [#102](https://github.com/akomapahealth/akomapa-lms/issues/102), [#103](https://github.com/akomapahealth/akomapa-lms/issues/103) |
| Verified recovery, and a published RPO and RTO | Issue | [#104](https://github.com/akomapahealth/akomapa-lms/issues/104). **No RPO or RTO may be published until the drill is performed** |
| Dependency vulnerabilities blocked before release | Code | `npm audit --audit-level=critical --omit=dev`, gitleaks, and CodeQL in `.github/workflows/ci.yml`; [#47](https://github.com/akomapahealth/akomapa-lms/issues/47) |

## Processors and transfers

| Obligation | Type | Control |
| --- | --- | --- |
| Processors named to learners | Disclosure | `/privacy` sharing section names Clerk, Stripe, Mux, UploadThing, Vercel, and the database host |
| Data processing agreement with each processor | **Legal** | Pending review, [policy 01](01-data-protection.md) |
| Transfer mechanism confirmed for EEA and UK data | **Legal** | Pending review, policy 01 |
| Inventory updated when a processor is added | Runbook | Policy 01. Adding analytics or an email provider changes the inventory and the public page |

## AI

Every row is gated on [#70](https://github.com/akomapahealth/akomapa-lms/issues/70)
and none may be implemented before it closes.

| Obligation | Type | Control |
| --- | --- | --- |
| Provider seam, kill switch, quota, no prompt logging | Issue | [ADR 0006](../adr/0006-ai-provider-abstraction.md) (Proposed), [#71](https://github.com/akomapahealth/akomapa-lms/issues/71) |
| No training on Academy data; DPA executed | **Legal** | [policy 03](03-ai-acceptable-use-and-safety.md) |
| Grounding, citation, uncertainty, medical-advice refusal | Issue | Rubric in #70; [#75](https://github.com/akomapahealth/akomapa-lms/issues/75), [#78](https://github.com/akomapahealth/akomapa-lms/issues/78) |
| Retrieval scoped by entitlement | Issue | [#74](https://github.com/akomapahealth/akomapa-lms/issues/74), ADR 0002 |
| Evaluation thresholds before enabling | Issue | [#79](https://github.com/akomapahealth/akomapa-lms/issues/79) |
| AI conversation retention | **Legal** | Proposed 90 days, policy 03 |

## Summary of what is not yet satisfied

- **Five issues filed and open:** [#117](https://github.com/akomapahealth/akomapa-lms/issues/117) self-service deletion and
  export; [#118](https://github.com/akomapahealth/akomapa-lms/issues/118) automated retention enforcement; [#119](https://github.com/akomapahealth/akomapa-lms/issues/119) public
  privacy and terms update; [#120](https://github.com/akomapahealth/akomapa-lms/issues/120) certificate revocation;
  [#121](https://github.com/akomapahealth/akomapa-lms/issues/121) the email-notification capability gap.
- **Six clauses pending legal review:** processor DPAs; transfer mechanisms;
  the data subject response deadline; the financial retention minimum and
  deletion grace period; breach notification deadlines; AI conversation
  retention and the FERPA applicability question.
- **No RPO or RTO exists** and none may be published before
  [#104](https://github.com/akomapahealth/akomapa-lms/issues/104).
