const isProd = process.env.NODE_ENV === "production";

/**
 * Structured context attached to a log line.
 *
 * Safe identifiers only: a correlation id, a database error code, a route tag.
 * Never a secret, a token, raw payment data, private Journal or community
 * content, an answer key, or an AI prompt (policy 01). #102 replaces this with
 * real structured logging and redaction.
 */
export type LogContext = Record<string, string | number | boolean | undefined>;

/**
 * An expected, handled event worth seeing in aggregate -- a refused cross-site
 * request, for example -- that is not a fault. Kept off `console.error` so it
 * does not page anyone.
 */
export function logWarn(tag: string, context?: LogContext) {
  if (isProd) {
    console.warn(
      JSON.stringify({ tag, timestamp: new Date().toISOString(), ...context })
    );
  } else {
    console.warn(`[${tag}]`, context ?? "");
  }
}

export function logError(tag: string, error: unknown, context?: LogContext) {
  if (isProd) {
    // In production, log tag and message only - no stack traces
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(
      JSON.stringify({
        tag,
        message,
        timestamp: new Date().toISOString(),
        ...context,
      })
    );
  } else {
    console.error(`[${tag}]`, error, context ?? "");
  }
}
