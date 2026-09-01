# 01. Data protection and privacy

- **Status:** Approved, with marked clauses pending legal review
- **Approver:** Prince Agyei Tuffour (@nanaagyei), 2026-08-30
- **Public counterpart:** `/privacy`, generated from `lib/legal-content.ts`

## Roles

The Akomapa Health Foundation is the **controller** for all personal data
processed by Akomapa Academy. Every third party listed in the inventory below
is a **processor** acting on the Foundation's instructions, except Stripe,
which acts as an independent controller for its own fraud-prevention and
regulatory obligations.

**PENDING LEGAL REVIEW:** a data processing agreement must be in place with
each processor before the v1 launch, and the transfer mechanism for each must
be confirmed. Tracked in policy 08.

## Data inventory

Every store that holds personal data, what it holds, and who processes it. This
inventory is the input to the retention schedule in
[policy 02](02-retention-and-deletion.md).

| Data class | Contents | Store and processor | Sensitivity |
| --- | --- | --- | --- |
| Identity | Clerk user id, email, first and last name, image URL, Google sign-in linkage | Clerk; mirrored to `User` in PostgreSQL (Supabase) | Personal |
| Staff profile | `bio`, `title`, `specialization` for Faculty and Administrators | `User` (Supabase) | Personal, self-supplied, learner-visible |
| Learning records | `Enrollment`, `UserProgress`, `QuizAttempt`, `QuizAnswer`, `CaseStudyAttempt`, `LearningStreak`, `UserBadge` | Supabase | Education record |
| Assessment keys | `QuestionOption.isCorrect` | Supabase | Not personal, but never disclosed to learners pre-submission or logged |
| Reflection | `JournalEntry` content, default `isPrivate: true` | Supabase | Sensitive. Private learner reflection |
| Community | `ForumPost`, `ForumComment`, `PostLike`, `CommentLike` | Supabase | Personal, learner-published |
| Credentials | `Certificate`, including `certificateNumber` and `pdfUrl` | Supabase; PDF via UploadThing | Personal, and partly public by design at `/verify` |
| Payments | `Purchase`, `StripCustomer.stripeCustomerId` | Supabase; card data and transaction records held by Stripe only | Financial. No card data ever reaches Akomapa systems |
| Uploads | Course attachments, images, certificate PDFs | UploadThing | Mixed |
| Video | Course video assets and playback ids (`MuxData`) | Mux | Content, plus Mux-side viewing telemetry |
| Preferences | `UserSettings` including theme and notification flags | Supabase | Personal, low sensitivity |
| Operational logs | Request and error logs emitted by `lib/logger.ts` and captured by the platform | Vercel | May contain IP address and user agent |

**No analytics or product-telemetry SDK is installed.** There is no Vercel
Analytics, Sentry, PostHog, or equivalent in `package.json`. The only telemetry
is the platform request and error logging above. Any future addition is a
change to this inventory and to the public privacy page.

## Lawful bases

Stated for GDPR and UK GDPR; the equivalent Ghanaian and US analyses follow the
same processing purposes.

| Purpose | Lawful basis |
| --- | --- |
| Creating and operating an account | Contract |
| Delivering Courses, recording progress, grading Quizzes | Contract |
| Issuing and publicly verifying Certificates | Contract, and legitimate interest in credential integrity for the public verification surface |
| Taking payment for a Course | Contract, and legal obligation for retained financial records |
| Community and Journal features | Contract |
| Moderating content and preventing abuse | Legitimate interest |
| Security logging, incident investigation, and fraud prevention | Legitimate interest |
| Notifying learners about their own activity | Consent, through `UserSettings`. **Not currently exercised: no email delivery capability exists.** See policy 05 |

## Never logged

Reproduced from [CONTEXT.md](../../CONTEXT.md) because it is a privacy control,
not only an engineering convention. The following must never appear in logs,
telemetry, error reports, analytics, or support tooling:

secrets and tokens; raw payment data; `JournalEntry` content; private Community
content; answer keys (`QuestionOption.isCorrect`); and, when AI Pro exists, AI
prompts and completions. Telemetry uses correlation ids and safe identifiers.

## Data subject rights

The Foundation honours these rights for **every** learner, without a
jurisdiction test, because segmenting rights by geography would be both harder
to operate and worse for the audience PRODUCT.md describes:

access, rectification, erasure, restriction, portability (a machine-readable
export of the learner's own account, learning records, Journal, and Community
content), objection to processing based on legitimate interest, and the right
to complain to a supervisory authority.

**How a request is made and handled.** Requests arrive through the contact
route in `siteConfig.contactUrl`. Identity is verified against the Clerk
account before anything is disclosed or deleted. The target is acknowledgement
within 5 working days and completion within 30 days, extendable once by 30 days
for a complex request, with the learner informed.

**PENDING LEGAL REVIEW:** the 30 day completion target is the GDPR one month
standard. Confirm the Ghanaian Act 843 timescale and any US state deadline that
is shorter, and adopt the shortest.

**No self-service path exists yet.** Deletion and export are manual operations
today. The self-service flow is tracked in [#117](https://github.com/akomapahealth/akomapa-lms/issues/117).

## International transfers

Data is processed in the United States and in whichever regions the processors
operate. For EEA and UK learners this is a restricted transfer.

**PENDING LEGAL REVIEW:** confirm the transfer mechanism for each processor
(Standard Contractual Clauses, the UK Addendum, or an adequacy decision) and
record it in policy 08 before launch.

## Children

The Academy is intended for learners in or beyond health-professional training
and is not directed at children. Accounts are not knowingly created for anyone
under 16. Where an account is found to belong to someone under 16 it is
suspended and the data deleted under [policy 02](02-retention-and-deletion.md).

## Public by design

Certificate verification at `/verify` is deliberately public and
unauthenticated: a credential nobody can check is not a credential. A
verification lookup may show the learner name, Course, and issue date tied to
that certificate number. This is disclosed at issuance and in the public
privacy page, and it is the one place where deletion does not remove a
learner-identifying record. See [policy 02](02-retention-and-deletion.md).
