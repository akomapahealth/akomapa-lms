# 06. Incident response

- **Status:** Approved, with notification deadlines pending legal review
- **Approver:** Prince Agyei Tuffour (@nanaagyei), 2026-08-30

## Severity

Severity is set by impact, not by cause, and by the worst plausible reading of
the evidence available at the time. Severity is raised freely and lowered only
with a reason recorded.

| Level | Definition | Examples |
| --- | --- | --- |
| **SEV1** | Personal data is exposed to someone not entitled to it, or credential integrity is broken | Cross-learner data disclosure; Journal Entries readable by another account; a forged or spoofable Certificate; answer keys reachable before submission; database credentials leaked |
| **SEV2** | A security or safety control has failed but no confirmed exposure, or a payment integrity failure | Authorization check missing on a route; RLS policy disabled in production; PHI submitted to a learner surface; payment taken with no access granted; a critical dependency vulnerability with a reachable path |
| **SEV3** | Learners cannot use a core journey | Sign-in failing; Course player down; Quiz submission failing; Certificate issuance stalled |
| **SEV4** | Degraded or cosmetic, with a workaround | Slow video start; a broken image; an analytics gap |

A suspected SEV1 is handled as a SEV1 until disproved.

## Roles

Roles are held by people, not teams, given the size of the group. One person
may hold several, but the incident lead never also does the remediation for a
SEV1: the lead's job is to keep the timeline and the decisions honest.

- **Incident lead:** runs the response, owns the timeline, decides severity,
  decides on notification. Currently Prince Agyei Tuffour (@nanaagyei).
- **Responder:** investigates and remediates.
- **Communications owner:** learner and authority communication. Currently the
  incident lead.

## Timeline

1. **Detect and declare.** Anyone may declare. Declaration starts a written
   timeline, kept from the first minute rather than reconstructed afterwards.
2. **Contain**, and prefer containment over diagnosis. Disable the affected
   route, revoke the credential, or take the feature down. Availability is
   sacrificed to stop exposure, never the reverse.
3. **Preserve evidence** before remediating: logs, database state, and the
   deploy that introduced it. Remediation that destroys the evidence makes the
   postmortem impossible.
4. **Assess scope.** Which data, how many people, which regions, from when to
   when. Record what is known, what is suspected, and what is unknown, and keep
   those three separate.
5. **Remediate**, then verify the fix with a test that fails before it.
6. **Notify**, per the section below.
7. **Postmortem** within 5 working days for SEV1 and SEV2.

## Notification

**PENDING LEGAL REVIEW:** the deadlines below are the GDPR baseline. Confirm
the Ghanaian Act 843 requirement and any US state breach-notification deadline
that is shorter, and adopt the shortest.

- **Supervisory authority:** within **72 hours** of becoming aware of a
  personal data breach that is likely to risk people's rights, notify the
  relevant authority, which may include the Ghana Data Protection Commission
  and an EEA or UK authority. Notify late with an explanation rather than not
  at all.
- **Affected learners:** without undue delay where the breach is likely to
  result in a high risk to them. The notice says what happened, what data, what
  the Foundation is doing, and what the learner should do. It never minimises
  and never blames the learner.
- **Processors:** where a processor caused it, obtain their written account and
  keep it with the timeline.
- **Payment incidents:** notify Stripe per their requirements.

A decision **not** to notify is recorded with its reasoning and reviewed by the
incident lead. Silence is never the default.

## Postmortem

Blameless, written, and kept. It records the timeline with timestamps, the
technical cause, the detection gap, the scope, what was and was not notified
and why, and the actions taken. Every action becomes a tracked issue with an
owner, and any action that would prevent a repeat of a SEV1 is a
`release-blocker`.

The postmortem asks what allowed the fault to reach production, not who wrote
it. A postmortem that names a person as the cause is rejected and rewritten.

## Known limitations

Stated honestly, because a response plan that assumes capability it does not
have will fail when used:

- **No automated alerting.** Structured logging, correlation, traces, and
  alerts are [#102](https://github.com/akomapahealth/akomapa-lms/issues/102);
  health and readiness checks are
  [#103](https://github.com/akomapahealth/akomapa-lms/issues/103). Until those
  land, detection depends on someone noticing or a learner reporting.
- **No verified restore.** Backup and restore have not been drilled;
  [#104](https://github.com/akomapahealth/akomapa-lms/issues/104) owns that and
  is itself blocked by this policy. Recovery time is therefore **unknown**, and
  no RPO or RTO may be published until that drill has been performed.
- **No out-of-hours rota.** See [policy 05](05-support-and-service-levels.md).
