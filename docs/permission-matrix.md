# Permission matrix

The authorization rules for Akomapa Academy, as enforced by `lib/auth/policy.ts`.

This document and that module must agree. The matrix is executable: every row
below is asserted in `tests/unit/auth/policy.test.ts`, and the action vocabulary
in `lib/auth/actions.ts` is mapped to rules by a total `Record<Action, Rule>`, so
adding an action without deciding who may perform it does not compile.

Implements [ADR 0001](adr/0001-identity-authentication-and-rbac.md). Owned by
[#42](https://github.com/akomapahealth/akomapa-lms/issues/42).

## Principles

1. **One derivation point.** `requirePrincipal()` in `lib/auth/principal.ts` is
   the only place a principal is produced. Nothing else calls Clerk's `auth()`
   and reasons about the result.
2. **Deny by default.** An absent principal, an unrecognised role, an unknown
   action, or a resource whose relationship cannot be established denies the
   request. A missing check is a denial, never an allow.
3. **`ADMIN` implies `FACULTY`.** `FACULTY` does not imply `ADMIN`. `STUDENT`
   implies neither.
4. **Ownership is asserted in the query.** The `authorize*` guards in
   `lib/auth/guards.ts` put the ownership condition inside the statement that
   loads the resource, so an authorized-but-unrelated row is never read.
5. **Nothing is taken from the browser.** Role, ownership, price, score,
   completion, and entitlement are never read from a request body, query string,
   header, or client prop.

## Rules

Each action maps to exactly one rule.

| Rule | Meaning |
| --- | --- |
| `adminOnly` | `ADMIN` only. Ownership is not consulted. |
| `facultyGlobal` | `FACULTY` or `ADMIN`. No resource ownership required. |
| `facultyOwned` | `FACULTY` or `ADMIN` **and** the principal owns the resource. |
| `authorOrModerator` | The content's author, or any principal holding `community:moderate`. |
| `authorOnly` | The content's author, and nobody else — not even a moderator. |
| `activeEnrollment` | An Enrollment whose status is `ACTIVE` or `COMPLETED`. |
| `reserved` | Denied unconditionally until the owning issue implements the surface. |

### Ownership

Ownership is already modelled in `prisma/schema.prisma` and needs no migration.

- **Course** — `Course.userId`, the creator.
- **Module** — the owning Course's creator, **or** `Module.facultyId`, the
  assigned faculty member. Assigned teaching is deliberately modelled separately
  from global administration.
- **Community content** — `ForumPost.userId` / `ForumComment.userId`.

## The matrix

### Course authoring

| Action | Rule | STUDENT | FACULTY (owner) | FACULTY (other) | ADMIN (owner) | ADMIN (other) |
| --- | --- | --- | --- | --- | --- | --- |
| `course:create` | `facultyGlobal` | deny | allow | allow | allow | allow |
| `course:read` | `facultyOwned` | deny | allow | deny | allow | deny |
| `course:update` | `facultyOwned` | deny | allow | deny | allow | deny |
| `course:delete` | `facultyOwned` | deny | allow | deny | allow | deny |
| `course:publish` | `facultyOwned` | deny | allow | deny | allow | deny |
| `module:*`, `topic:*`, `attachment:*` | `facultyOwned` | deny | allow | deny | allow | deny |
| `upload:courseAsset` | `facultyGlobal` | deny | allow | allow | allow | allow |

**ADMIN does not override Course ownership.** This preserves what
`DELETE /api/courses/[courseId]` enforces today. Whether an ADMIN should be able
to edit any Course is a product decision owned by
[#86](https://github.com/akomapahealth/akomapa-lms/issues/86); changing it means
changing this table and the tests that assert it, deliberately.

### Assessment authoring

| Action | Rule | STUDENT | FACULTY (owner) | FACULTY (other) | ADMIN (other) |
| --- | --- | --- | --- | --- | --- |
| `quiz:create` | `facultyOwned` | deny | allow | deny | deny |
| `quiz:read`, `quiz:update`, `quiz:delete`, `quiz:publish` | `facultyOwned` | deny | allow | deny | deny |
| `question:create`, `question:update`, `question:delete`, `question:reorder` | `facultyOwned` | deny | allow | deny | deny |
| `caseStudy:create`, `caseStudy:update`, `caseStudy:delete` | `facultyOwned` | deny | allow | deny | deny |

### Community

| Action | Rule | STUDENT (author) | STUDENT (other) | FACULTY (other) | ADMIN |
| --- | --- | --- | --- | --- | --- |
| `post:update`, `post:delete` | `authorOrModerator` | allow | deny | deny | allow |
| `comment:delete` | `authorOrModerator` | allow | deny | deny | allow |
| `comment:update` | `authorOnly` | allow | deny | deny | **deny** |
| `community:moderate` | `adminOnly` | deny | deny | deny | allow |

`community:moderate` covers pinning, locking, category management, and acting on
content the principal did not write.

**`comment:update` is author-only on purpose.** A moderator may remove a comment
but not rewrite it: editing leaves someone's name on words they did not write,
which is a worse outcome than removal and is invisible to the person it happened
to. This preserves the behaviour the comment route has always had.
[#89](https://github.com/akomapahealth/akomapa-lms/issues/89) revisits it when it
adds audit trails and reversible moderation.

### Administration

| Action | Rule | STUDENT | FACULTY | ADMIN |
| --- | --- | --- | --- | --- |
| `analytics:read` | `adminOnly` | deny | deny | allow |
| `learner:administer` | `adminOnly` | deny | deny | allow |
| `role:manage` | `adminOnly` | deny | deny | allow |

`role:manage` has no user interface yet;
[#88](https://github.com/akomapahealth/akomapa-lms/issues/88) builds it. Until
then roles are granted with `npm run role:grant` (see below).

### Learner access

| Action | Rule | `ACTIVE` | `COMPLETED` | `SUSPENDED` | no Enrollment |
| --- | --- | --- | --- | --- | --- |
| `course:learn` | `activeEnrollment` | allow | allow | deny | deny |

Privilege does not buy back a suspension: an ADMIN with a `SUSPENDED` Enrollment
is denied. The full entitlement rule — purchase, Enrollment as the canonical
record, free-preview Topics — is
[ADR 0002](adr/0002-enrollment-as-canonical-entitlement.md) and
[#48](https://github.com/akomapahealth/akomapa-lms/issues/48). What this rule
owns is the narrower suspension invariant.

### Reserved

| Action | Rule | Everyone | Owning issue |
| --- | --- | --- | --- |
| `billing:administer` | `reserved` | deny | [#72](https://github.com/akomapahealth/akomapa-lms/issues/72), [#73](https://github.com/akomapahealth/akomapa-lms/issues/73) |
| `ai:administer` | `reserved` | deny | [#79](https://github.com/akomapahealth/akomapa-lms/issues/79) |

These names exist so that a future caller cannot assume an unnamed action is
permitted. They deny for every role until their owning issue implements them.

## Denial responses

| Reason | Status | When |
| --- | --- | --- |
| `unauthenticated` | 401 | No principal. |
| `forbidden` | 403 | Authenticated, but the role cannot perform this action on any resource. |
| `not_found` | 404 | The resource is absent, **or** present and not the principal's. |

The last two cases are deliberately indistinguishable. Answering 403 for "exists
but is not yours" and 404 for "does not exist" turns an endpoint into an oracle
for enumerating other people's Courses.

## Granting roles

Privilege comes from `User.role` and nothing else. The `TEACHER_ID` environment
variable was removed in #42 (ADR 0001 §6).

There is no in-app way to grant the first ADMIN, so a deployment with no ADMIN
row cannot be administered and cannot repair itself. Before deploying:

```
npm run role:grant -- --email someone@example.com --role ADMIN
npm run role:list     # confirm
npm run role:check    # exits non-zero if no ADMIN exists
```

The user must sign in once first, so the Clerk webhook creates their `User` row.

**Prefer `--email` over `--user`.** Clerk keeps separate user directories for its
development and production instances, so the same person has a *different*
`user_...` id in each. A development id can never match a production `User` row,
and nothing in the id says which instance produced it — so the mistake is silent.
Email is stable across both, and the row is already in whichever database the
command is pointed at, so nothing has to be copied between systems.

To read an id out of a specific environment rather than the Clerk dashboard:

```
npm run role:find -- --email someone@example.com
```

### Running against production

These commands never run *in* production. They run on your machine and connect
to whatever `DATABASE_URL` points at — Vercel has no shell to run an npm script
in. "Granting an administrator in production" therefore means running the command
locally, pointed at the production database.

```
vercel link                                              # once per checkout
vercel env pull .env.production.local --environment production

DATABASE_URL="$(grep -m1 '^DATABASE_URL=' .env.production.local | cut -d= -f2- | tr -d '"')" \
  npm run role:check
```

`.env.production.local` matches `.env*.local` in `.gitignore` and is never
committed.

**Every command prints the database it is about to act on**, with credentials
stripped:

```
target: ep-xxxx.eu-central-1.aws.neon.tech:5432/akomapa  [from shell]
```

Read that line before granting. `[from shell]` means an exported `DATABASE_URL`
is in effect; `[from .env]` means a dotenv file is, which almost always means you
are pointed at your own machine.

An exported `DATABASE_URL` takes precedence over both dotenv files. This is not
incidental: `.env.local` is loaded with `override: true`, so without that
precedence an operator running the pre-flight against production would be
silently redirected to their local database — told an administrator was granted,
while production still had none. That is the exact failure the pre-flight exists
to prevent.


`assertAdminExists()` in `lib/auth/bootstrap.ts` is the same check as a function,
ready for [#103](https://github.com/akomapahealth/akomapa-lms/issues/103) to
mount on a readiness endpoint. Until that endpoint exists, `npm run role:check`
is a **manual** deploy step — CI cannot run it, because CI has no database.
