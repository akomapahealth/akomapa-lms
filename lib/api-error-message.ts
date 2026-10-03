import { isAxiosError } from "axios";

/**
 * The toast text for a failed API call (#46).
 *
 * Most failures keep the caller's own wording ("Failed to save"), because the
 * component knows best what the learner was doing. Two do not, because the
 * generic wording is actively harmful for them: "Something went wrong" after a
 * rate limit invites an immediate retry that will fail again, and after a
 * store outage it suggests the learner did something wrong.
 *
 * - **429** says how long to wait, from `Retry-After`.
 * - **503** says the action is temporarily unavailable.
 *
 * Nothing in the returned text comes from the response body, so a server
 * message can never be injected into the page through it.
 */
export function apiErrorMessage(error: unknown, fallback: string): string {
  if (!isAxiosError(error) || error.response === undefined) return fallback;

  const { status, headers } = error.response;
  const retryAfter = readRetryAfter(headers?.["retry-after"]);

  if (status === 429) {
    return retryAfter === null
      ? "You're doing that too often. Please wait a moment and try again."
      : `You're doing that too often. Please try again in ${describeWait(retryAfter)}.`;
  }

  if (status === 503) {
    return "This is temporarily unavailable. Please try again in a minute.";
  }

  return fallback;
}

/** Parses delay-seconds. An HTTP-date or anything malformed is ignored. */
function readRetryAfter(value: unknown): number | null {
  if (typeof value !== "string" || !/^\d+$/.test(value.trim())) return null;
  const seconds = Number(value.trim());
  return seconds > 0 ? seconds : null;
}

/** "45 seconds", "1 minute", "3 minutes" -- rounded up, never "0". */
export function describeWait(seconds: number): string {
  if (seconds < 60) return seconds === 1 ? "1 second" : `${seconds} seconds`;
  const minutes = Math.ceil(seconds / 60);
  return minutes === 1 ? "1 minute" : `${minutes} minutes`;
}
