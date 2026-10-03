import type { Prisma } from "@prisma/client";

import { OUTBOX } from "./config";

/**
 * Operator operations on the outbox (#69): health, listing, retention, replay,
 * and discard. Each takes its database client explicitly and imports nothing
 * server-only, so the cron route and the `npm run outbox` CLI share one
 * implementation.
 */

type OperationsClient = Pick<Prisma.TransactionClient, "outboxEvent">;

export interface ParkedEvent {
  id: string;
  type: string;
  attempts: number;
  lastError: string | null;
  occurredAt: Date;
  parkedAt: Date | null;
}

/** Parked events, oldest first. Identifiers and error text only, never payloads. */
export async function listParked(client: OperationsClient, limit = 50): Promise<ParkedEvent[]> {
  return client.outboxEvent.findMany({
    where: { parkedAt: { not: null }, completedAt: null },
    orderBy: { parkedAt: "asc" },
    take: limit,
    select: { id: true, type: true, attempts: true, lastError: true, occurredAt: true, parkedAt: true },
  });
}

export interface OutboxHealth {
  /** Undelivered, unparked events. */
  pending: number;
  /** Age of the oldest of them, in seconds; 0 when none. */
  oldestPendingSeconds: number;
  parked: number;
}

/** The signals ADR 0005 names: depth, oldest undelivered, parked. */
export async function outboxHealth(client: OperationsClient, now: Date = new Date()): Promise<OutboxHealth> {
  const [pending, oldest, parked] = await Promise.all([
    client.outboxEvent.count({ where: { completedAt: null, parkedAt: null } }),
    client.outboxEvent.findFirst({
      where: { completedAt: null, parkedAt: null },
      orderBy: { occurredAt: "asc" },
      select: { occurredAt: true },
    }),
    client.outboxEvent.count({ where: { parkedAt: { not: null }, completedAt: null } }),
  ]);
  return {
    pending,
    oldestPendingSeconds: oldest ? Math.max(0, Math.floor((now.getTime() - oldest.occurredAt.getTime()) / 1000)) : 0,
    parked,
  };
}

/** Deletes delivered events past retention. Parked events are never purged. */
export async function purgeDelivered(client: OperationsClient, now: Date = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - OUTBOX.retentionDays * 86_400_000);
  const { count } = await client.outboxEvent.deleteMany({
    where: { completedAt: { lt: cutoff }, parkedAt: null },
  });
  return count;
}

/**
 * Returns parked events to the queue with a fresh retry budget: after a fix
 * has shipped, or a dependency has recovered. Returns how many were requeued.
 */
export async function replayParked(
  client: OperationsClient,
  ids: readonly string[] | "all",
  now: Date = new Date()
): Promise<number> {
  const { count } = await client.outboxEvent.updateMany({
    where: {
      parkedAt: { not: null },
      completedAt: null,
      ...(ids === "all" ? {} : { id: { in: [...ids] } }),
    },
    data: { parkedAt: null, attempts: 0, availableAt: now, leasedUntil: null, leasedBy: null },
  });
  return count;
}

/**
 * Closes parked events nobody should deliver -- a consumer was retired, the
 * fact is obsolete -- as completed, with the reason kept in `lastError`.
 */
export async function discardParked(
  client: OperationsClient,
  ids: readonly string[],
  reason: string,
  now: Date = new Date()
): Promise<number> {
  const { count } = await client.outboxEvent.updateMany({
    where: { id: { in: [...ids] }, parkedAt: { not: null }, completedAt: null },
    data: { completedAt: now, lastError: `discarded: ${reason}`.slice(0, OUTBOX.errorChars) },
  });
  return count;
}

