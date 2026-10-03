import { describe, expect, it, vi } from "vitest";

import {
  appendEvents,
  DomainEventType,
  EVENT_PAYLOADS,
  EVENT_SHAPES,
  EVENT_VERSION,
  type DomainEvent,
} from "@/lib/outbox/events";

function writer(count = 1) {
  const createMany = vi.fn().mockResolvedValue({ count });
  return { tx: { outboxEvent: { createMany } } as never, createMany };
}

let n = 0;
const ids = () => `event_${++n}`;

describe("the event table", () => {
  it("describes every DomainEventType", () => {
    const types = Object.values(DomainEventType).sort();
    expect(Object.keys(EVENT_PAYLOADS).sort()).toEqual(types);
    expect(Object.keys(EVENT_SHAPES).sort()).toEqual(types);
  });
});

describe("appendEvents", () => {
  it("writes nothing for no events", async () => {
    const { tx, createMany } = writer();

    await expect(appendEvents(tx, [])).resolves.toBe(0);
    expect(createMany).not.toHaveBeenCalled();
  });

  it("records each event with its aggregate, version, and dedupe key", async () => {
    const { tx, createMany } = writer(2);
    const events: DomainEvent[] = [
      { type: "COURSE_COMPLETED", payload: { userId: "u1", courseId: "c1" } },
      { type: "BADGE_AWARDED", payload: { userId: "u1", badgeId: "b1" } },
    ];

    await expect(appendEvents(tx, events, ids)).resolves.toBe(2);

    const { data, skipDuplicates } = createMany.mock.calls[0][0];
    expect(skipDuplicates).toBe(true);
    expect(data[0]).toMatchObject({
      type: "COURSE_COMPLETED",
      version: EVENT_VERSION,
      aggregateType: "Enrollment",
      aggregateId: "u1:c1",
      payload: { userId: "u1", courseId: "c1" },
      dedupeKey: "COURSE_COMPLETED:u1:c1",
    });
    expect(data[1]).toMatchObject({
      aggregateType: "UserBadge",
      aggregateId: "u1:b1",
      dedupeKey: "BADGE_AWARDED:u1:b1",
    });
  });

  it.each([
    ["MODULE_COMPLETED", { userId: "u", courseId: "c", moduleId: "m" }, "Enrollment", "MODULE_COMPLETED:u:m"],
    ["CERTIFICATE_ISSUED", { userId: "u", courseId: "c", certificateId: "cert" }, "Certificate", "CERTIFICATE_ISSUED:cert"],
    ["QUIZ_ATTEMPT_COMPLETED", { userId: "u", quizId: "q", attemptId: "a" }, "QuizAttempt", "QUIZ_ATTEMPT_COMPLETED:a"],
  ] as const)("keys %s as a one-time fact", async (type, payload, aggregateType, dedupeKey) => {
    const { tx, createMany } = writer();

    await appendEvents(tx, [{ type, payload } as DomainEvent], ids);

    expect(createMany.mock.calls[0][0].data[0]).toMatchObject({ aggregateType, dedupeKey });
  });

  it.each(["TOPIC_COMPLETED", "TOPIC_UNCOMPLETED"] as const)(
    "lets %s recur, keyed by its own id",
    async (type) => {
      const { tx, createMany } = writer();

      await appendEvents(tx, [{ type, payload: { userId: "u", courseId: "c", topicId: "t" } }], () => "evt-9");

      expect(createMany.mock.calls[0][0].data[0]).toMatchObject({
        id: "evt-9",
        aggregateId: "u:c",
        dedupeKey: `${type}:evt-9`,
      });
    }
  );

  it("refuses content in a payload, and writes nothing when any event is malformed", async () => {
    const { tx, createMany } = writer();
    const events = [
      { type: "COURSE_COMPLETED", payload: { userId: "u", courseId: "c" } },
      // A Journal body has no business in an event.
      { type: "TOPIC_COMPLETED", payload: { userId: "u", courseId: "c", topicId: "t", note: "private" } },
    ] as unknown as DomainEvent[];

    await expect(appendEvents(tx, events)).rejects.toThrow();
    expect(createMany).not.toHaveBeenCalled();
  });

  it("refuses a missing identifier", async () => {
    const { tx } = writer();

    await expect(
      appendEvents(tx, [{ type: "BADGE_AWARDED", payload: { userId: "u" } } as unknown as DomainEvent])
    ).rejects.toThrow();
  });

  it("uses random ids by default", async () => {
    const { tx, createMany } = writer();

    await appendEvents(tx, [{ type: "TOPIC_COMPLETED", payload: { userId: "u", courseId: "c", topicId: "t" } }]);

    expect(createMany.mock.calls[0][0].data[0].id).toMatch(/^[0-9a-f-]{36}$/);
  });
});
