import type { DomainEventType, Prisma } from "@prisma/client";
import { ZodError } from "zod";

import { db } from "@/lib/db";
import { logInfo, logWarn } from "@/lib/logger";

import type { OutboxHealth } from "./operations";

import { OUTBOX } from "./config";
import { dispatchEvent } from "./handlers";

/**
 * The outbox processor (#69, ADR 0005).
 *
 * Commands record events in their own transactions (lib/outbox/events.ts).
 * This delivers them: it claims a bounded batch, hands each event to its
 * consumer, and records the outcome.
 *
 * - **At least once.** A delivery can repeat -- a worker can die after the
 *   effect and before recording success -- so every consumer is idempotent
 *   (lib/outbox/handlers.ts), and that is what keeps a repeat harmless.
 * - **Safe under concurrency.** Rows are claimed with `FOR UPDATE SKIP LOCKED`
 *   and a lease, so overlapping cron invocations never deliver the same row
 *   together. An outcome is written only while the worker still holds the
 *   lease, so a worker that outlived its lease cannot overwrite a newer one.
 * - **Bounded failure.** A failed delivery retries with exponential backoff up
 *   to `maxAttempts`, then is parked. A payload that no longer validates, or a
 *   consumer that reports a permanent failure, is parked at once: retrying
 *   cannot fix it. Parked events never block the rest, and stay until an
 *   operator replays or discards them (`npm run outbox`).
 * - **Bounded time.** A run stops claiming before its time budget, well inside
 *   the function's maximum duration, and leaves the rest for the next run.
 */

export { OUTBOX } from "./config";

/** A consumer's way to say "retrying will not help": park immediately. */
export class PermanentEventError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PermanentEventError";
  }
}

/**
 * The delay before retry `attempt` (1-based): base x 2^(attempt-1), capped,
 * with +/-20% jitter so a burst of failures does not retry in lockstep.
 */
export function backoffDelayMs(attempt: number, random: () => number = Math.random): number {
  const exponential = OUTBOX.baseDelayMs * 2 ** Math.max(0, attempt - 1);
  const capped = Math.min(OUTBOX.maxDelayMs, exponential);
  return Math.round(capped * (0.8 + 0.4 * random()));
}

/** Whether a failure can never succeed on retry. */
export function isPermanent(error: unknown): boolean {
  return error instanceof ZodError || error instanceof PermanentEventError;
}

/** The stored error: class and message, bounded. Never a payload or a stack. */
export function describeError(error: unknown): string {
  const text = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  return text.slice(0, OUTBOX.errorChars);
}

type OutboxClient = Pick<Prisma.TransactionClient, "$queryRaw" | "$executeRaw" | "outboxEvent">;

export interface ClaimedEvent {
  id: string;
  type: DomainEventType;
  payload: unknown;
  attempts: number;
}

/**
 * Claims up to `limit` deliverable events for `workerId`.
 *
 * Deliverable: not delivered, not parked, due, and not leased -- or leased
 * by a worker whose lease has expired, which is how a crashed worker's events
 * come back. SKIP LOCKED lets concurrent claimers take disjoint rows instead
 * of waiting on each other.
 */
export async function claimBatch(
  client: OutboxClient,
  workerId: string,
  now: Date,
  limit: number = OUTBOX.batchSize
): Promise<ClaimedEvent[]> {
  const leaseUntil = new Date(now.getTime() + OUTBOX.leaseMs);
  return client.$queryRaw<ClaimedEvent[]>`
    UPDATE "OutboxEvent" AS e
       SET "leasedUntil" = ${leaseUntil}, "leasedBy" = ${workerId}
      FROM (
        SELECT id FROM "OutboxEvent"
         WHERE "completedAt" IS NULL
           AND "parkedAt" IS NULL
           AND "availableAt" <= ${now}
           AND ("leasedUntil" IS NULL OR "leasedUntil" < ${now})
         ORDER BY "availableAt", "occurredAt"
         LIMIT ${limit}
         FOR UPDATE SKIP LOCKED
      ) AS due
     WHERE e.id = due.id
    RETURNING e.id, e.type, e.payload, e.attempts
  `;
}

export type DeliveryOutcome = "delivered" | "retried" | "parked" | "lease_lost";

/**
 * Delivers one claimed event and records what happened, guarded by the lease.
 */
export async function deliver(
  client: OutboxClient,
  event: ClaimedEvent,
  workerId: string,
  now: () => Date,
  dispatch: (type: DomainEventType, payload: unknown) => Promise<void> = dispatchEvent,
  random: () => number = Math.random
): Promise<DeliveryOutcome> {
  const ours = { id: event.id, leasedBy: workerId, completedAt: null };
  const released = { leasedUntil: null, leasedBy: null };

  try {
    await dispatch(event.type, event.payload);
  } catch (error) {
    const attempts = event.attempts + 1;
    const lastError = describeError(error);
    const park = isPermanent(error) || attempts >= OUTBOX.maxAttempts;
    const at = now();

    const { count } = await client.outboxEvent.updateMany({
      where: ours,
      data: park
        ? { ...released, attempts, lastError, parkedAt: at }
        : {
            ...released,
            attempts,
            lastError,
            availableAt: new Date(at.getTime() + backoffDelayMs(attempts, random)),
          },
    });
    if (count === 0) return "lease_lost";

    // Event id and type only: the payload carries learner identifiers, and the
    // error text is in the row for whoever investigates.
    if (park) {
      logWarn("OUTBOX_PARKED", { eventId: event.id, type: event.type, attempts });
      return "parked";
    }
    logWarn("OUTBOX_RETRY", { eventId: event.id, type: event.type, attempts });
    return "retried";
  }

  const { count } = await client.outboxEvent.updateMany({
    where: ours,
    data: { ...released, attempts: event.attempts + 1, lastError: null, completedAt: now() },
  });
  return count === 0 ? "lease_lost" : "delivered";
}

export interface RunSummary {
  claimed: number;
  delivered: number;
  retried: number;
  parked: number;
  leaseLost: number;
  stoppedForBudget: boolean;
  durationMs: number;
}

export interface RunOptions {
  client?: OutboxClient;
  workerId?: string;
  now?: () => Date;
  dispatch?: (type: DomainEventType, payload: unknown) => Promise<void>;
  random?: () => number;
  budgetMs?: number;
  batchSize?: number;
}

/** Delivers due events in batches until none are left or the budget is spent. */
export async function runOutbox(options: RunOptions = {}): Promise<RunSummary> {
  const client = options.client ?? db;
  const now = options.now ?? (() => new Date());
  const workerId = options.workerId ?? `worker-${globalThis.crypto.randomUUID()}`;
  const budgetMs = options.budgetMs ?? OUTBOX.budgetMs;
  const started = now().getTime();

  const summary: RunSummary = {
    claimed: 0,
    delivered: 0,
    retried: 0,
    parked: 0,
    leaseLost: 0,
    stoppedForBudget: false,
    durationMs: 0,
  };
  const tally: Record<DeliveryOutcome, keyof RunSummary> = {
    delivered: "delivered",
    retried: "retried",
    parked: "parked",
    lease_lost: "leaseLost",
  };

  for (;;) {
    if (now().getTime() - started >= budgetMs) {
      summary.stoppedForBudget = true;
      break;
    }
    const batch = await claimBatch(client, workerId, now(), options.batchSize ?? OUTBOX.batchSize);
    if (batch.length === 0) break;
    summary.claimed += batch.length;

    for (const event of batch) {
      const outcome = await deliver(client, event, workerId, now, options.dispatch, options.random);
      (summary[tally[outcome]] as number) += 1;
    }
  }

  summary.durationMs = now().getTime() - started;
  return summary;
}

export {
  discardParked,
  listParked,
  outboxHealth,
  purgeDelivered,
  replayParked,
  type OutboxHealth,
} from "./operations";

/** Logs a run's summary and the queue's health as one structured line. */
export function logRun(summary: RunSummary, health: OutboxHealth, purged: number): void {
  const context = { ...summary, ...health, purged };
  // A warning when something is parked, which an operator should look at;
  // otherwise a routine record.
  if (summary.parked > 0 || health.parked > 0) {
    logWarn("OUTBOX_RUN", context);
  } else {
    logInfo("OUTBOX_RUN", context);
  }
}
