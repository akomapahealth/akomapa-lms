import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { testDb } from "./support/db";
import { aCourseWithTopic, anEnrollmentRow, aUserRow } from "./support/fixtures";

vi.mock("@/lib/db", async () => {
  const { testDb: get } = await import("./support/db");
  return {
    get db() {
      return get();
    },
  };
});
vi.mock("@react-pdf/renderer", () => ({
  renderToBuffer: vi.fn(async (element: { props: { certificateNumber: string } }) =>
    Buffer.from(`pdf:${element.props.certificateNumber}`)
  ),
}));
vi.mock("@/lib/certificate-template", () => ({ CertificateTemplate: () => null }));

const { appendEvents } = await import("@/lib/outbox/events");
const { issueCertificate } = await import("@/lib/certificate-service");
const { dispatchEvent } = await import("@/lib/outbox/handlers");
const { claimBatch, deliver, OUTBOX, runOutbox } = await import("@/lib/outbox/processor");
const { outboxHealth, purgeDelivered, replayParked } = await import("@/lib/outbox/operations");
const { GET: cronOutbox } = await import("@/app/api/cron/outbox/route");
const { renderToBuffer } = await import("@react-pdf/renderer");

/**
 * The outbox processor against real PostgreSQL (#69, ADR 0005).
 */

const T0 = new Date("2026-07-01T00:00:00Z");
const at = (ms: number) => () => new Date(T0.getTime() + ms);

/** Records n recurring events, as a command would, all due at T0. */
async function record(n: number) {
  for (let i = 0; i < n; i += 1) {
    await appendEvents(testDb(), [
      { type: "TOPIC_COMPLETED", payload: { userId: `u${i}`, courseId: "c", topicId: `t${i}` } },
    ]);
  }
  await testDb().outboxEvent.updateMany({ data: { availableAt: T0, occurredAt: T0 } });
}

async function aReservedCertificate() {
  const author = await aUserRow({ role: "FACULTY" });
  const courseId = (await aCourseWithTopic(author.id)).course.id;
  const learner = await aUserRow();
  await anEnrollmentRow(learner.id, courseId, "COMPLETED");
  const issued = await issueCertificate(testDb(), learner.id, courseId, T0);
  await appendEvents(testDb(), [
    { type: "CERTIFICATE_ISSUED", payload: { userId: learner.id, courseId, certificateId: issued.certificateId } },
  ]);
  await testDb().outboxEvent.updateMany({ data: { availableAt: T0 } });
  return issued;
}

beforeEach(() => {
  vi.mocked(renderToBuffer).mockClear();
});

describe("concurrent workers", () => {
  it("deliver every event exactly once between them", async () => {
    await record(60);
    const deliveries: string[] = [];
    const dispatch = async (_type: string, payload: unknown) => {
      deliveries.push((payload as { topicId: string }).topicId);
    };

    const [a, b] = await Promise.all([
      runOutbox({ workerId: "a", now: at(1000), dispatch, batchSize: 7 }),
      runOutbox({ workerId: "b", now: at(1000), dispatch, batchSize: 7 }),
    ]);

    expect(a.delivered + b.delivered).toBe(60);
    expect(new Set(deliveries).size).toBe(60);
    expect(deliveries).toHaveLength(60);
    expect(await testDb().outboxEvent.count({ where: { completedAt: null } })).toBe(0);
  });

  it("does not take events another worker holds a live lease on", async () => {
    await record(3);
    await claimBatch(testDb(), "a", T0);

    expect(await claimBatch(testDb(), "b", at(OUTBOX.leaseMs - 1)())).toEqual([]);
  });
});

describe("crashes", () => {
  it("re-delivers after a crash that followed the side effect, without repeating it", async () => {
    const issued = await aReservedCertificate();

    // Worker A claims, renders the PDF, and dies before recording success.
    const [claimed] = await claimBatch(testDb(), "a", T0);
    await dispatchEvent(claimed.type, claimed.payload);
    expect(vi.mocked(renderToBuffer)).toHaveBeenCalledTimes(1);

    // Its lease expires; worker B delivers the event again.
    const summary = await runOutbox({ workerId: "b", now: at(OUTBOX.leaseMs + 1) });

    expect(summary.delivered).toBe(1);
    expect(vi.mocked(renderToBuffer)).toHaveBeenCalledTimes(1);
    const certificate = await testDb().certificate.findUniqueOrThrow({ where: { id: issued.certificateId } });
    expect(certificate.pdfUrl).not.toBeNull();
  });

  it("delivers after a crash that came before the side effect", async () => {
    await aReservedCertificate();
    await claimBatch(testDb(), "a", T0); // and dies

    const summary = await runOutbox({ workerId: "b", now: at(OUTBOX.leaseMs + 1) });

    expect(summary.delivered).toBe(1);
    expect(vi.mocked(renderToBuffer)).toHaveBeenCalledTimes(1);
  });

  it("lets a worker that outlived its lease record nothing over the new claim", async () => {
    await record(1);
    const [stale] = await claimBatch(testDb(), "a", T0);
    await claimBatch(testDb(), "b", at(OUTBOX.leaseMs + 1)());

    const outcome = await deliver(testDb(), stale, "a", at(OUTBOX.leaseMs + 2), async () => {});

    expect(outcome).toBe("lease_lost");
    const row = await testDb().outboxEvent.findFirstOrThrow();
    expect(row.leasedBy).toBe("b");
    expect(row.completedAt).toBeNull();
  });
});

describe("failure", () => {
  const failing = async () => {
    throw new Error("render service unavailable");
  };

  it("retries after backoff, then parks, and a parked event waits for an operator", async () => {
    await record(1);
    let clock = 0;

    for (let attempt = 1; attempt <= OUTBOX.maxAttempts; attempt += 1) {
      const summary = await runOutbox({ workerId: "w", now: at(clock), dispatch: failing, random: () => 0.5 });
      expect(summary.claimed).toBe(1);

      const row = await testDb().outboxEvent.findFirstOrThrow();
      expect(row.attempts).toBe(attempt);
      expect(row.lastError).toBe("Error: render service unavailable");

      if (attempt < OUTBOX.maxAttempts) {
        // Not due again before its backoff.
        expect((await runOutbox({ workerId: "w", now: at(clock + 1), dispatch: failing })).claimed).toBe(0);
        clock = row.availableAt.getTime() - T0.getTime();
      } else {
        expect(row.parkedAt).not.toBeNull();
      }
    }

    // Parked: never claimed again, however much time passes.
    expect((await runOutbox({ workerId: "w", now: at(clock + 30 * 86_400_000), dispatch: failing })).claimed).toBe(0);
    expect(await outboxHealth(testDb(), at(clock)())).toMatchObject({ pending: 0, parked: 1 });

    // After the fix ships, an operator replays it and it delivers.
    expect(await replayParked(testDb(), "all", at(clock)())).toBe(1);
    const summary = await runOutbox({ workerId: "w", now: at(clock + 1), dispatch: async () => {} });
    expect(summary.delivered).toBe(1);
  });

  it("parks a stored payload that no longer validates at once", async () => {
    await testDb().outboxEvent.create({
      data: {
        type: "CERTIFICATE_ISSUED",
        aggregateType: "Certificate",
        aggregateId: "x",
        payload: { certificateId: "x" },
        dedupeKey: "hand-edited",
        availableAt: T0,
      },
    });

    const summary = await runOutbox({ workerId: "w", now: at(1) });

    expect(summary.parked).toBe(1);
    const row = await testDb().outboxEvent.findFirstOrThrow();
    expect(row.attempts).toBe(1);
    expect(row.lastError).toMatch(/^ZodError/);
  });

  it("does not let one poison event block the rest", async () => {
    await record(3);
    let calls = 0;
    const dispatch = async () => {
      calls += 1;
      if (calls === 1) throw new Error("first one fails");
    };

    const summary = await runOutbox({ workerId: "w", now: at(1), dispatch });

    expect(summary).toMatchObject({ delivered: 2, retried: 1 });
  });
});

describe("retention", () => {
  it("purges delivered events past retention and keeps parked and recent ones", async () => {
    await record(3);
    const [old, recent, parked] = await testDb().outboxEvent.findMany({ orderBy: { id: "asc" } });
    const longAgo = new Date(T0.getTime() - (OUTBOX.retentionDays + 1) * 86_400_000);
    await testDb().outboxEvent.update({ where: { id: old.id }, data: { completedAt: longAgo } });
    await testDb().outboxEvent.update({ where: { id: recent.id }, data: { completedAt: T0 } });
    await testDb().outboxEvent.update({ where: { id: parked.id }, data: { parkedAt: longAgo } });

    expect(await purgeDelivered(testDb(), T0)).toBe(1);
    expect((await testDb().outboxEvent.findMany()).map((r) => r.id).sort()).toEqual([parked.id, recent.id].sort());
  });
});

describe("the cron route", () => {
  const SECRET = "cron-placeholder-secret-integration";
  const call = (authorization?: string) =>
    cronOutbox(
      new Request("http://localhost:3000/api/cron/outbox", {
        headers: authorization ? { authorization } : {},
      })
    );

  beforeEach(() => {
    vi.stubEnv("CRON_SECRET", SECRET);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("refuses a call without the secret, and does no work", async () => {
    await record(1);

    expect((await call()).status).toBe(401);
    expect((await call("Bearer wrong-secret-of-enough-length")).status).toBe(401);
    expect(await testDb().outboxEvent.count({ where: { completedAt: null } })).toBe(1);
  });

  it("refuses every call when CRON_SECRET is not configured", async () => {
    vi.stubEnv("CRON_SECRET", "");

    expect((await call(`Bearer ${SECRET}`)).status).toBe(500);
  });

  it("delivers due events and reports the queue's health", async () => {
    const issued = await aReservedCertificate();
    await testDb().outboxEvent.updateMany({ data: { availableAt: new Date(Date.now() - 1000) } });

    const response = await call(`Bearer ${SECRET}`);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.summary).toMatchObject({ delivered: 1, parked: 0 });
    expect(body.health).toEqual({ pending: 0, oldestPendingSeconds: 0, parked: 0 });
    const certificate = await testDb().certificate.findUniqueOrThrow({ where: { id: issued.certificateId } });
    expect(certificate.pdfUrl).not.toBeNull();
  });
});
