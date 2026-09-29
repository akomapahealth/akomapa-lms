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
