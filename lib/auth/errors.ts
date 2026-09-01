import { NextResponse } from "next/server";

/**
 * Why a request was denied.
 *
 * The distinction matters to the client. Returning 401 for a permission failure
 * -- which is what every handler does today -- makes the web app redirect a
 * signed-in user to the sign-in page, where signing in again changes nothing.
 */
export type DenialReason =
  /** No principal at all. */
  | "unauthenticated"
  /** Authenticated, but the role cannot perform this action anywhere. */
  | "forbidden"
  /**
   * The resource does not exist, or exists and is not the principal's.
   *
   * These two are deliberately indistinguishable. Answering 403 for "exists but
   * is not yours" and 404 for "does not exist" turns the endpoint into an
   * oracle for enumerating other people's Courses.
   */
  | "not_found";

export class Denied extends Error {
  readonly reason: DenialReason;
  readonly action?: string;

  constructor(reason: DenialReason, action?: string) {
    // The message is for server logs. It names the action, never the resource
    // id, the principal, or anything else that should not reach a log line.
    super(action ? `denied: ${reason} (${action})` : `denied: ${reason}`);
    this.name = "Denied";
    this.reason = reason;
    this.action = action;
  }
}

const STATUS: Record<DenialReason, number> = {
  unauthenticated: 401,
  forbidden: 403,
  not_found: 404,
};

const BODY: Record<DenialReason, string> = {
  unauthenticated: "Unauthorized",
  forbidden: "Forbidden",
  not_found: "Not Found",
};

export function isDenied(error: unknown): error is Denied {
  return error instanceof Denied;
}

/**
 * Converts a denial into a response. Returns null for anything else, so a
 * handler's catch block can re-raise genuine faults instead of reporting an
 * internal error as a permission problem.
 */
export function toResponse(error: unknown): NextResponse | null {
  if (!isDenied(error)) return null;
  return new NextResponse(BODY[error.reason], { status: STATUS[error.reason] });
}
