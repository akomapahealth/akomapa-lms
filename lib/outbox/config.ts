/**
 * Outbox delivery settings (#69). Plain constants with no imports, so the
 * processor, the operator CLI, and the tests share them without pulling in the
 * database client or server-only consumers.
 */
export const OUTBOX = {
  /** Events claimed per round trip. */
  batchSize: 25,
  /** How long a claim is exclusive. Longer than any single delivery. */
  leaseMs: 5 * 60_000,
  /** Deliveries before an event is parked. */
  maxAttempts: 8,
  /** First retry delay; doubles each attempt. */
  baseDelayMs: 60_000,
  /** Longest retry delay. */
  maxDelayMs: 6 * 60 * 60_000,
  /** Delivered events are deleted after this many days. Parked ones are kept. */
  retentionDays: 30,
  /** A run stops claiming after this long (the cron function allows 60s). */
  budgetMs: 45_000,
  /** Longest stored error text. */
  errorChars: 500,
} as const;
