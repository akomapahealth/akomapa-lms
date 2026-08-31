# 05. Support and service levels

- **Status:** Approved
- **Approver:** Prince Agyei Tuffour (@nanaagyei), 2026-08-30

## What is actually true

Akomapa Academy is run by a small nonprofit team. There is no paid on-call
rota. This policy describes best-effort support with response **targets**, not
contractual guarantees, because publishing an SLA the team cannot staff would
be a promise broken on the first bad week.

## Channels and hours

The contact route in `siteConfig.contactUrl` is the single support channel.
Community posts are not a support channel; a support question posted publicly
is redirected, and anything containing personal or payment details is removed
under [policy 07](07-moderation-and-appeals.md).

Working hours span Ghana (GMT) and US Eastern business hours, Monday to Friday,
excluding public holidays in both locations.

## Response targets

Targets are measured from receipt to first substantive human response, in
working hours.

| Request | Target |
| --- | --- |
| Cannot sign in, or lost access to a purchased Course | 1 working day |
| Payment taken but no access granted | 1 working day |
| Certificate not issued after completion, or verification failing | 2 working days |
| Data subject request (access, export, deletion, correction) | Acknowledge in 5 working days; complete per [policy 01](01-data-protection.md) |
| Moderation report of harmful content | Same working day for anything involving safety; 2 working days otherwise |
| Moderation appeal | 5 working days |
| Content error or general question | 5 working days |

Missing a target is not an incident on its own. A pattern of missed targets is
reviewed and either the staffing or the target changes, and the published
target is corrected rather than quietly retained.

## Ownership and escalation

Support is owned by the Foundation's programme staff. Escalation is to a named
person, currently Prince Agyei Tuffour (@nanaagyei), for anything that is a
suspected security incident, a data subject request, a payment dispute, a
safety report, or a moderation appeal.

There is **no out-of-hours escalation path**. An incident raised outside
working hours is handled at the start of the next working period unless the
named escalation contact is reachable and chooses to act sooner. Severity
definitions and the incident timeline are in
[policy 06](06-incident-response.md).

## Not promised

Stated explicitly so nothing is inferred:

- No uptime guarantee, no service credits, no refund tied to availability.
- **No email notification.** The `emailOnBadgeEarned`, `emailOnForumReply`, and
  `emailOnFacultyComment` flags in `UserSettings` are stored preferences with
  **no delivery mechanism**: no email provider is installed. Until that changes,
  no policy, page, or interface may imply that email is sent. Tracked in
  [policy 08](08-obligation-to-control-map.md).
- No live chat, no telephone support, no guaranteed response outside working
  hours.
- No support for a learner's own device, browser, or network conditions beyond
  the responsive floors in [DESIGN.md](../../DESIGN.md).
