import { NextResponse } from "next/server";

/**
 * The one JSON error shape every route handler answers with (#44).
 *
 * Before this, handlers answered with bare text bodies -- "Invalid data",
 * "Unauthorized", "Internal Error" -- and chose statuses inconsistently: one
 * publish route answered 401 for a missing title, which makes the web app send
 * a signed-in author to the sign-in page. A client could not distinguish "your
 * input was wrong" from "you may not do this" from "the server broke" without
 * string-matching prose.
 *
 * The shape is documented in docs/api-errors.md, which is the contract clients
 * may rely on. Keep the two in step.
 *
 * Deliberately absent from every response: stack traces, Prisma messages, zod
 * messages, schema fragments, and the offending values. A field-level failure
 * reports the path and a machine code, which is enough to fix a request without
 * describing the schema to someone probing it.
 */

/**
 * Machine-readable failure codes. Clients branch on these, never on `message`.
 *
 * Adding one is a contract change: document it in docs/api-errors.md.
 */
export const ERROR_CODES = {
  /** No principal at all. 401. */
  unauthenticated: 401,
  /** Authenticated, but the role cannot perform this action anywhere. 403. */
  forbidden: 403,
  /**
   * The resource does not exist, or exists and is not the principal's. 404.
   *
   * Deliberately one code for both: answering 403 for "exists but is not
   * yours" turns the endpoint into an oracle for enumerating other people's
   * resources.
   */
  not_found: 404,
  /** A path or query parameter is missing or the wrong shape. 400. */
  invalid_parameter: 400,
  /** The body is not parseable JSON. 400. */
  malformed_json: 400,
  /** The body parsed but failed the schema: bounds, enums, unknown fields. 422. */
  validation_failed: 422,
  /** The request contradicts current state: already submitted, already bought. 409. */
  conflict: 409,
  /** The body exceeds the route's declared limit. 413. */
  payload_too_large: 413,
  /** The Content-Type is not one this route accepts. 415. */
  unsupported_media_type: 415,
  /** Abuse controls engaged. 429. Reserved for #46, which does the limiting. */
  rate_limited: 429,
  /** An unexpected fault. 500. Never carries detail. */
  internal: 500,
} as const;

export type ErrorCode = keyof typeof ERROR_CODES;

/** A single field-level failure. Path and code only -- never the value. */
export interface FieldProblem {
  /** Dotted path into the request body, e.g. `answers.3.questionId`. */
  path: string;
  /**
   * The kind of failure, from zod's issue vocabulary: `invalid_type`,
   * `too_big`, `too_small`, `invalid_string`, `invalid_enum_value`,
   * `unrecognized_keys`, and so on.
   */
  code: string;
}

export interface ProblemBody {
  error: {
    code: ErrorCode;
    /** Actionable, safe to show a user, and never derived from their input. */
    message: string;
    /** Ties this response to the server log line for the same request. */
    correlationId: string;
    /** Present only for `validation_failed` and `invalid_parameter`. */
    fields?: FieldProblem[];
  };
}

/** Header carrying the correlation id, so a client can quote it in a report. */
export const CORRELATION_HEADER = "x-correlation-id";

/**
 * Default human-readable text per code.
 *
 * Fixed strings: a message built from the request could echo an attacker's
 * input back into a page that renders it.
 */
const MESSAGES: Record<ErrorCode, string> = {
  unauthenticated: "Sign in to continue.",
  forbidden: "You do not have permission to perform this action.",
  not_found: "Not found.",
  invalid_parameter: "The request address is not valid.",
  malformed_json: "The request body is not valid JSON.",
  validation_failed: "The request body did not pass validation.",
  conflict: "The request conflicts with the current state of the resource.",
  payload_too_large: "The request body is too large.",
  unsupported_media_type: "The request Content-Type is not supported.",
  rate_limited: "Too many requests. Try again shortly.",
  internal: "Something went wrong on our side.",
};

/**
 * A failure a handler means to return, as opposed to a fault it did not expect.
 *
 * Throwing rather than returning lets validation live in a helper that a handler
 * calls in one line, while `handleRouteError` does the mapping in one place.
 */
export class ApiError extends Error {
  readonly code: ErrorCode;
  readonly fields?: FieldProblem[];
  readonly correlationId: string;

  constructor(
    code: ErrorCode,
    options: { fields?: FieldProblem[]; message?: string; correlationId?: string } = {}
  ) {
    // The message reaches server logs only. It names the code, never the
    // offending value.
    super(options.message ?? `api error: ${code}`);
    this.name = "ApiError";
    this.code = code;
    this.fields = options.fields;
    this.correlationId = options.correlationId ?? newCorrelationId();
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

/**
 * A fresh correlation id.
 *
 * `crypto.randomUUID` is global from Node 19. #102 replaces this with an id
 * propagated from the inbound request; until then a per-response id is still
 * enough to join a client report to a log line.
 */
export function newCorrelationId(): string {
  return globalThis.crypto.randomUUID();
}

export function statusFor(code: ErrorCode): number {
  return ERROR_CODES[code];
}

/** The body for a code, without building a Response. Used by tests and by #102. */
export function problemBody(
  code: ErrorCode,
  options: { fields?: FieldProblem[]; message?: string; correlationId?: string } = {}
): ProblemBody {
  const body: ProblemBody = {
    error: {
      code,
      message: options.message ?? MESSAGES[code],
      correlationId: options.correlationId ?? newCorrelationId(),
    },
  };

  // Omitted rather than empty: an empty array reads as "no field was at fault",
  // which is a different claim from "this failure is not field-level".
  if (options.fields && options.fields.length > 0) {
    body.error.fields = options.fields;
  }

  return body;
}

/**
 * Builds a problem response, correlation header included.
 *
 * Lives here rather than beside `handleRouteError` so that `lib/auth/errors.ts`
 * can answer a denial in this shape without importing the route layer, which
 * imports `lib/auth/errors.ts` in turn. Keeping the builder free of that
 * dependency is what stops the two from forming a cycle.
 */
export function problem(
  code: ErrorCode,
  options: { fields?: FieldProblem[]; message?: string; correlationId?: string } = {}
): NextResponse {
  const correlationId = options.correlationId ?? newCorrelationId();
  const body = problemBody(code, { ...options, correlationId });

  return NextResponse.json(body, {
    status: statusFor(code),
    headers: { [CORRELATION_HEADER]: correlationId },
  });
}
