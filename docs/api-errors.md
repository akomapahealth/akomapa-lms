# API error responses

The shape every route handler under `app/api/` answers a failure with, and the
contract a client may rely on.

- **Status:** Approved
- **Owner:** Prince Agyei Tuffour (@nanaagyei)
- **Implemented by:** [#44](https://github.com/akomapahealth/akomapa-lms/issues/44)
- **Code:** `lib/http/problem.ts` (shape), `lib/http/route.ts` (the single exit
  point), `lib/http/validate.ts` (where most failures originate)

## Why this document exists

Before #44 each handler chose its own body and status. `POST /api/courses`
answered `"Internal Error"` with 500 when a title was missing, because the title
went unvalidated and the non-null column rejected it.
`PATCH /api/courses/[courseId]/publish` answered **401** for an incomplete
Course, which made the web app redirect a signed-in author to the sign-in page,
where signing in again changed nothing. A client could not distinguish "your
input was wrong" from "you may not do this" from "the server broke" without
matching on English prose.

## The shape

Every failure — from a malformed body to an authorization denial to an
unexpected fault — is a JSON object:

```json
{
  "error": {
    "code": "validation_failed",
    "message": "The request body did not pass validation.",
    "correlationId": "9f1c5f4e-7a2b-4c3d-8e9f-0a1b2c3d4e5f",
    "fields": [
      { "path": "title", "code": "too_big" },
      { "path": "isPinned", "code": "unrecognized_keys" }
    ]
  }
}
```

| Field | Always present | Meaning |
| --- | --- | --- |
| `code` | yes | Machine-readable. **Branch on this, never on `message`.** |
| `message` | yes | A fixed, human-readable sentence. Safe to show a user. |
| `correlationId` | yes | Also sent as the `x-correlation-id` response header. Joins this response to the server log line for the same request. |
| `fields` | no | Present only for field-level failures. Omitted, never empty. |

## Codes and statuses

| Code | Status | When |
| --- | --- | --- |
| `unauthenticated` | 401 | No session. Signing in would help. |
| `forbidden` | 403 | Signed in, but the role cannot do this anywhere. Signing in again will not help. |
| `untrusted_origin` | 403 | A mutation that did not come from a trusted origin: cross-site, a sibling subdomain, or no `Origin`. Checked before authentication. See [security/csrf.md](security/csrf.md). |
| `not_found` | 404 | The resource does not exist, **or** exists and is not yours. |
| `invalid_parameter` | 400 | A path or query segment is missing or the wrong shape, e.g. a non-uuid id. |
| `malformed_json` | 400 | The body is not parseable JSON, or is not valid UTF-8. |
| `validation_failed` | 422 | The body parsed but failed the schema: a bound, an enum, an unknown field. |
| `conflict` | 409 | The request contradicts current state: already submitted, already purchased, not publishable yet, or content learners have used (delete refused; see [runbooks/database-integrity.md](runbooks/database-integrity.md)). |
| `payload_too_large` | 413 | The body exceeds the route's declared limit. |
| `unsupported_media_type` | 415 | The `Content-Type` is not JSON. |
| `rate_limited` | 429 | A rate limit engaged. Always sent with `Retry-After`. Keyed on the caller and the operation, never the resource, so it reveals nothing about whether the resource exists. See [security/rate-limits.md](security/rate-limits.md). |
| `internal` | 500 | An unexpected fault. Carries no detail. |
| `temporarily_unavailable` | 503 | A dependency the operation will not run without is down: the rate-limit store, for a policy that fails closed. Always sent with `Retry-After`. |

### 400 versus 422

`invalid_parameter` and `malformed_json` are 400: the request could not be
understood. `validation_failed` is 422: it was understood and rejected. The
split matters to a form, which can map `fields` onto inputs for a 422 and has
nowhere to put a 400.

### 404 for "not yours"

"Does not exist" and "exists but is not yours" are deliberately
indistinguishable. Answering 403 for the second turns every endpoint into an
oracle for enumerating other people's Courses, Journals, and attempts.

## What never appears in a response

- Stack traces.
- Prisma messages. They name the table, the column, and the constraint. A unique
  violation becomes `conflict` with no detail.
- zod messages. They quote both the schema (`Expected 'PRE_TEST' | 'POST_TEST'`)
  and the submitted value. Only the field path and the issue code cross the
  boundary.
- The offending value, anywhere. `fields[].path` says *where*, `fields[].code`
  says *what kind*, and nothing echoes the input back.
- The action name from an authorization denial. It reaches the log line via
  `Denied.message`; it would describe the permission model to whoever is probing
  it.

The one exception is `unrecognized_keys`, whose `path` names the refused key.
That key is the caller's own input, so naming it leaks nothing they did not just
send, and without it the caller cannot tell which field to drop.

## `fields[].code`

Taken from zod's issue vocabulary, so it is stable and machine-readable:
`invalid_type`, `too_big`, `too_small`, `invalid_string`, `invalid_enum_value`,
`unrecognized_keys`, `custom`, and others. A handler may also emit a domain code
for a check a schema cannot express — `not_in_quiz`, `not_in_post`, `max_depth`.

## `Retry-After`

Sent with every `rate_limited` and `temporarily_unavailable` response, as whole
seconds (at least 1), and never with anything else. It is a header, not a body
field, so the body keeps the shape above. A client should wait at least that
long before retrying the same request; the web app tells the learner how long
(`lib/api-error-message.ts`).

## Correlation ids

Every response carries one, in the body and in the `x-correlation-id` header. For
a 500 or a mapped database failure the same id is written to the log line, so a
user quoting it from a support request locates their exact request. It is
generated per response; [#102](https://github.com/akomapahealth/akomapa-lms/issues/102)
replaces that with an id propagated from the inbound request across traces.

## Size limits

Declared per route shape in `lib/http/limits.ts`, and enforced *while* reading
the body rather than after, so an oversized request is refused without being
buffered. `Content-Length` is checked first as a cheap rejection, but it is a
client claim: the streaming byte count is the enforcement.

| Limit | Bytes | Routes |
| --- | --- | --- |
| `default` | 16 KB | Bodies of a few scalars: a title, a boolean, an id. |
| `reorder` | 64 KB | Reorder payloads. Sized from `COUNT.reorder` so the count bound is the one that reports. |
| `richText` | 512 KB | Posts, comments, journal entries, Topic text content. |
| `document` | 1 MB | Case study scenarios. |

Upload limits are separate and live in `app/api/uploadthing/core.ts`.

## Exceptions

Three routes are not principal-authenticated and do not use the `lib/auth`
guards. They still answer in this shape.

- `POST /api/webhook` — Stripe, verified by signature. An unhandled event type is
  acknowledged with **200 and no body**: Stripe retries anything that is not a
  2xx, so an event this app ignores must not be reported as a failure.
- `POST /api/webhooks/clerk` — Clerk, verified by svix. Same convention.
- `/api/uploadthing` — authenticates inside `core.ts`, and surfaces
  `UploadThingError` rather than this shape, because the client library expects
  its own protocol. The exceptions are refusals that happen before the library
  runs -- the origin guard's `untrusted_origin` and the rate limiter's
  `rate_limited` and `temporarily_unavailable` -- which answer in this shape,
  plus a top-level `message` copied from `error.message`, because UploadThing's
  client displays only that field.

The two webhooks are also exempt from the origin guard, and so are
UploadThing's signed server callbacks; browser upload requests are not. See
[security/csrf.md](security/csrf.md#exemptions).

### Server components are not in scope

This shape is for `app/api/` route handlers. Pages and server components answer a
bad path segment with `notFound()` or a redirect, because a person is reading
them, not a program. They are also read-only, and their `where` clauses are
parameterised, so an unvalidated id there is a miss rather than a write.

Delivery semantics for the two webhooks — duplicate events, reordering,
retry-safety — are [#54](https://github.com/akomapahealth/akomapa-lms/issues/54)
and [#69](https://github.com/akomapahealth/akomapa-lms/issues/69), not this
document.

## Adding a code

A contract change. Add it to `ERROR_CODES` in `lib/http/problem.ts`, add a row
here, and extend `tests/unit/http/problem.test.ts`, which asserts the whole
table — so a status changing silently fails the build.
