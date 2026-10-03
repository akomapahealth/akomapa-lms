import { DomainEventType, type Prisma } from "@prisma/client";
import { z } from "zod";

/**
 * The domain events, and the one way to record them (#49, ADR 0004).
 *
 * A command appends events with `appendEvents(tx, ...)` inside the transaction
 * that changes the state they describe, so the fact and the record that it
 * happened commit together or not at all. Nothing here delivers anything:
 * claiming and processing rows is #69 (ADR 0005).
 *
 * Every event type has a payload schema, an aggregate, and a dedupe key, in one
 * exhaustive table: a type added to the schema's `DomainEventType` enum fails
 * to compile until it is described here.
 *
 * Payloads are identifiers only (ADR 0005 point 6). Schemas are `.strict()`, so
 * a stray field -- content, a score, a token -- is refused rather than stored.
 */

const id = z.string().min(1).max(191);

const learnerTopic = z.object({ userId: id, courseId: id, topicId: id }).strict();

export const EVENT_PAYLOADS = {
  TOPIC_COMPLETED: learnerTopic,
  TOPIC_UNCOMPLETED: learnerTopic,
  MODULE_COMPLETED: z.object({ userId: id, courseId: id, moduleId: id }).strict(),
  COURSE_COMPLETED: z.object({ userId: id, courseId: id }).strict(),
  CERTIFICATE_ISSUED: z.object({ userId: id, courseId: id, certificateId: id }).strict(),
  BADGE_AWARDED: z.object({ userId: id, badgeId: id }).strict(),
  QUIZ_ATTEMPT_COMPLETED: z.object({ userId: id, quizId: id, attemptId: id }).strict(),
} satisfies Record<DomainEventType, z.ZodTypeAny>;

export type EventPayload<T extends DomainEventType> = z.infer<(typeof EVENT_PAYLOADS)[T]>;

export type DomainEvent = {
  [T in DomainEventType]: { type: T; payload: EventPayload<T> };
}[DomainEventType];

interface EventShape<T extends DomainEventType> {
  aggregate: (p: EventPayload<T>) => { type: string; id: string };
  /**
   * The key that makes a fact recorded twice one row. `null` for events that
   * may legitimately recur -- a Topic completed, uncompleted, and completed
   * again -- which commands emit only on an actual state change, under a lock.
   */
  dedupe: (p: EventPayload<T>) => string | null;
}

const enrollment = (p: { userId: string; courseId: string }) => ({
  type: "Enrollment",
  id: `${p.userId}:${p.courseId}`,
});

export const EVENT_SHAPES: { [T in DomainEventType]: EventShape<T> } = {
  TOPIC_COMPLETED: { aggregate: enrollment, dedupe: () => null },
  TOPIC_UNCOMPLETED: { aggregate: enrollment, dedupe: () => null },
  // Historical facts: the first time is the fact. A Module or Course finished
  // again after an uncomplete is not a second achievement.
  MODULE_COMPLETED: {
    aggregate: enrollment,
    dedupe: (p) => `MODULE_COMPLETED:${p.userId}:${p.moduleId}`,
  },
  COURSE_COMPLETED: {
    aggregate: enrollment,
    dedupe: (p) => `COURSE_COMPLETED:${p.userId}:${p.courseId}`,
  },
  CERTIFICATE_ISSUED: {
    aggregate: (p) => ({ type: "Certificate", id: p.certificateId }),
    dedupe: (p) => `CERTIFICATE_ISSUED:${p.certificateId}`,
  },
  BADGE_AWARDED: {
    aggregate: (p) => ({ type: "UserBadge", id: `${p.userId}:${p.badgeId}` }),
    dedupe: (p) => `BADGE_AWARDED:${p.userId}:${p.badgeId}`,
  },
  QUIZ_ATTEMPT_COMPLETED: {
    aggregate: (p) => ({ type: "QuizAttempt", id: p.attemptId }),
    dedupe: (p) => `QUIZ_ATTEMPT_COMPLETED:${p.attemptId}`,
  },
};

/** The current payload version for every type; bump with a payload change. */
export const EVENT_VERSION = 1;

type OutboxWriter = Pick<Prisma.TransactionClient, "outboxEvent">;

/**
 * Records events in the caller's transaction.
 *
 * Validates every payload before writing anything, so one malformed event
 * fails the whole command rather than recording half of what happened. A fact
 * already recorded (same dedupe key) is skipped, which is what makes a retried
 * command idempotent. Returns the number of rows actually written.
 */
export async function appendEvents(
  tx: OutboxWriter,
  events: readonly DomainEvent[],
  newId: () => string = () => globalThis.crypto.randomUUID()
): Promise<number> {
  if (events.length === 0) return 0;

  const rows = events.map((event) => {
    const schema = EVENT_PAYLOADS[event.type] as z.ZodTypeAny;
    const payload = schema.parse(event.payload) as Record<string, string>;
    const shape = EVENT_SHAPES[event.type] as EventShape<typeof event.type>;
    const aggregate = shape.aggregate(payload as never);
    const eventId = newId();

    return {
      id: eventId,
      type: event.type,
      version: EVENT_VERSION,
      aggregateType: aggregate.type,
      aggregateId: aggregate.id,
      payload,
      dedupeKey: shape.dedupe(payload as never) ?? `${event.type}:${eventId}`,
    };
  });

  const { count } = await tx.outboxEvent.createMany({ data: rows, skipDuplicates: true });
  return count;
}

export { DomainEventType };
