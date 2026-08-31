# 07. Moderation and appeals

- **Status:** Approved
- **Approver:** Prince Agyei Tuffour (@nanaagyei), 2026-08-30
- **Public counterpart:** the "Acceptable use" and "Your content" sections of `/terms`

## Standards

The Community exists so learners can think aloud with peers. Moderation
protects that, and nothing more. Disagreement, difficult questions, and
unfinished thinking are the point and are never moderated.

Removed: harassment, abuse, and discriminatory content; identifiable patient
information, per [policy 04](04-educational-scope.md); doxxing and other
people's personal data; answer keys, Quiz content, and coordinated academic
dishonesty; spam, promotion, and recruitment; content that is illegal in Ghana
or the United States.

## Actions

Proportionate, and escalating only on repetition. Every action is recorded with
the actor, the reason, and the timestamp.

| Action | When | Notice to the author |
| --- | --- | --- |
| Edit or redact | A single element breaches, for example a patient detail in an otherwise good post | Yes, with the reason |
| Remove content | The content itself breaches | Yes, with the reason and the appeal path |
| Lock a thread | The thread has stopped being useful | Announced in the thread |
| Warn | First or second breach | Yes |
| Suspend | Repeated breach after warning, or a single serious one | Yes, with duration and the appeal path |
| Ban | Severe or persistent breach | Yes, with the appeal path |

**Immediate removal without prior warning** applies only to identifiable
patient information, doxxing, and content that presents a safety risk. The
notice still follows.

Suspension of Community access is separate from Course entitlement: a suspended
learner keeps access to Courses they are entitled to unless the
`Enrollment.status` is separately set to `SUSPENDED` for cause. Losing forum
access must never quietly remove something a learner paid for.

## Appeals

Every action is appealable through the contact route in
`siteConfig.contactUrl`. Target response is 5 working days
([policy 05](05-support-and-service-levels.md)).

An appeal is reviewed by someone other than the person who took the action
where the team size allows it, and where it does not, that fact is recorded in
the decision. Outcomes are uphold, reduce, or reverse. A reversal restores the
content where it is technically possible and says so where it is not.

## Audit trail

Moderation actions are recorded so they can be reviewed and reversed. The
record survives the author's account deletion, per
[policy 02](02-retention-and-deletion.md), so that a banned actor cannot erase
the record by deleting the account. The record holds the action, the actor, the
reason, the timestamp, and the appeal outcome. It never holds the removed
content itself where that content was removed for containing patient
information.

Moderation notes are internal and are excluded from a learner's data export.

## Current capability gap

Moderation today is manual: the admin Community surface allows pinning,
locking, and removal, but there is **no consolidated audit trail and no
reversible-action tooling**.
[#89](https://github.com/akomapahealth/akomapa-lms/issues/89) owns that. Until
it lands, the audit trail is maintained by hand by the acting Administrator,
and this policy's guarantees depend on that discipline.
