# 02. Retention and deletion

- **Status:** Approved, with retention minimums pending legal review
- **Approver:** Prince Agyei Tuffour (@nanaagyei), 2026-08-30
- **Public counterpart:** the "How long we keep information" section of `/privacy`, which currently says only "a reasonable period" and must be replaced with these periods

## Principle

Data is kept for as long as it serves the purpose it was collected for, plus
any period the law requires, and then it is deleted or de-identified. A
retention period that cannot be named is not a retention policy, which is why
every row below carries a number.

## Retention schedule

Periods run from the trigger named in each row. "De-identify" means severing
the link to a person while keeping the record for aggregate reporting.

| Data class | Store | Trigger | Retention | Then |
| --- | --- | --- | --- | --- |
| Identity | Clerk | Account deletion request | 30 days | Delete from Clerk; the mirrored `User` row is anonymised, not removed, so foreign keys survive |
| Account mirror | `User` (Supabase) | Account deletion request | 30 days | Anonymise: clear email, names, image, `bio`, `title`, `specialization`; retain the id |
| Learning records | `Enrollment`, `UserProgress`, `QuizAttempt`, `QuizAnswer`, `CaseStudyAttempt` | Account deletion request | 30 days | De-identify. Aggregate outcome data is retained for programme evaluation |
| Learning streaks and badges | `LearningStreak`, `UserBadge` | Account deletion request | 30 days | Delete |
| Journal entries | `JournalEntry` | Account deletion request | 30 days | **Delete outright.** Private reflection is never de-identified and retained |
| Community content | `ForumPost`, `ForumComment`, likes | Account deletion request | 30 days | Author is anonymised and the content remains, so threads stay coherent. A learner may instead request removal of specific posts, which is honoured |
| Certificates | `Certificate` | Never deleted while the credential stands | Indefinite | Retained. See "What survives deletion" |
| Certificate PDFs | UploadThing | Certificate revoked | 30 days | Delete the asset; the verification record remains |
| Payment records | `Purchase`, `StripCustomer` | Transaction date | **7 years, PENDING LEGAL REVIEW** | Retain for nonprofit accounting and audit. Confirm the correct minimum under Ghanaian and US law |
| Card and transaction data | Stripe only | Governed by Stripe | Per Stripe's retention | Never held by Akomapa systems |
| Course uploads and attachments | UploadThing | Course unpublished and archived | 12 months | Delete |
| Video assets | Mux | Course archived | 12 months | Delete the asset and `MuxData` row |
| Preferences | `UserSettings` | Account deletion request | 30 days | Delete |
| Operational logs | Vercel | Log write | Platform default retention | Expire. Never exported into another store |

The 30 day window on deletion requests is a grace period that lets a learner
reverse an accidental deletion and lets the Foundation resolve a payment
dispute. It is disclosed at the point of request.

**PENDING LEGAL REVIEW:** the 7 year financial retention and the 30 day grace
period both need confirmation against Ghanaian Act 843, US nonprofit
record-keeping rules, and the GDPR storage-limitation principle. Adopt the
shortest period that satisfies all of them.

## What survives deletion

Deleting an account does not delete:

1. **Issued Certificates and their verification records.** A credential that
   disappears when its holder deletes their account is worthless to the
   employer or institution relying on it. The verification page continues to
   show the name that appeared on the credential. This is disclosed at
   issuance, in the public privacy page, and in this policy. A learner who
   wants the credential withdrawn requests **revocation**, which marks it
   invalid and stops it verifying, rather than deletion.
2. **Financial records** required for accounting and audit, held for the period
   above.
3. **Moderation records** where content was removed for a safety violation,
   retained under [policy 07](07-moderation-and-appeals.md) so a banned actor
   cannot erase the record by deleting the account.
4. **Aggregate, de-identified learning outcomes** used for programme
   evaluation, which cannot be traced back to a person.

## Export

A learner may request a machine-readable export of their identity, learning
records, Journal entries, Community content, Certificates, and preferences.
Answer keys, other learners' data, and internal moderation notes are excluded.

## Current capability gap

**Deletion and export are manual operations today.** There is no self-service
flow, no scheduled job to enforce these periods, and no `vercel.json` cron
configured. Until the work in policy 08 lands, retention is enforced by a named
person following this schedule, and every execution is recorded. This is stated
plainly rather than implied, because a published policy promising automatic
deletion that does not happen is worse than no policy.
