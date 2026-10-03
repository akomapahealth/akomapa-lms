import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const logWarn = vi.hoisted(() => vi.fn());
const logInfo = vi.hoisted(() => vi.fn());
vi.mock("@/lib/logger", () => ({ logWarn, logInfo, logError: vi.fn() }));
vi.mock("@/lib/db", async () => ({ db: (await import("../support/db")).dbMock }));
vi.mock("@/lib/outbox/handlers", () => ({ dispatchEvent: vi.fn() }));

const {
  backoffDelayMs,
  claimBatch,
  deliver,
  describeError,
  discardParked,
  isPermanent,
  listParked,
  logRun,
  OUTBOX,
  outboxHealth,
  PermanentEventError,
  purgeDelivered,
  replayParked,
  runOutbox,
} = await import("@/lib/outbox/processor");

const T0 = new Date("2026-06-01T00:00:00Z");
const event = { id: "e1", type: "CERTIFICATE_ISSUED" as const, payload: { certificateId: "c" }, attempts: 0 };

function client(updated = 1) {
  return {
    $queryRaw: vi.fn().mockResolvedValue([]),
    $executeRaw: vi.fn(),
    outboxEvent: {
      updateMany: vi.fn().mockResolvedValue({ count: updated }),
      deleteMany: vi.fn().mockResolvedValue({ count: 4 }),
      count: vi.fn().mockResolvedValue(0),
      findFirst: vi.fn().mockResolvedValue(null),
    },
  };
}

beforeEach(() => {
  logWarn.mockClear();
  logInfo.mockClear();
});

describe("backoffDelayMs", () => {
  it.each([
    [1, 60_000],
    [2, 120_000],
    [3, 240_000],
  ])("doubles from the base: attempt %i waits %i ms without jitter", (attempt, ms) => {
    expect(backoffDelayMs(attempt, () => 0.5)).toBe(ms);
  });

  it("caps at the maximum delay", () => {
    expect(backoffDelayMs(30, () => 0.5)).toBe(OUTBOX.maxDelayMs);
  });

  it("jitters within +/-20%", () => {
    expect(backoffDelayMs(1, () => 0)).toBe(48_000);
    expect(backoffDelayMs(1, () => 1)).toBe(72_000);
  });

  it("treats attempt 0 like the first", () => {
    expect(backoffDelayMs(0, () => 0.5)).toBe(60_000);
  });

  it("uses Math.random by default", () => {
    const ms = backoffDelayMs(1);
    expect(ms).toBeGreaterThanOrEqual(48_000);
    expect(ms).toBeLessThanOrEqual(72_000);
  });
});

describe("isPermanent and describeError", () => {
  it("parks validation failures and explicit permanent errors, retries the rest", () => {
    const zodError = z.object({ a: z.string() }).safeParse({}).error!;
    expect(isPermanent(zodError)).toBe(true);
    expect(isPermanent(new PermanentEventError("gone"))).toBe(true);
    expect(isPermanent(new Error("timeout"))).toBe(false);
    expect(isPermanent("nope")).toBe(false);
  });

  it("records class and message, bounded", () => {
    expect(describeError(new TypeError("bad"))).toBe("TypeError: bad");
    expect(describeError("plain")).toBe("plain");
    expect(describeError(new Error("x".repeat(2000)))).toHaveLength(OUTBOX.errorChars);
  });
});

describe("claimBatch", () => {
  it("claims with a lease and SKIP LOCKED", async () => {
    const c = client();

    await claimBatch(c as never, "w1", T0, 10);

    const [strings, leaseUntil, workerId] = c.$queryRaw.mock.calls[0];
    const sql = (strings as TemplateStringsArray).join("?");
    expect(sql).toContain("FOR UPDATE SKIP LOCKED");
    expect(sql).toContain('"parkedAt" IS NULL');
    expect(sql).toContain('"leasedUntil" < ');
    expect(leaseUntil).toEqual(new Date(T0.getTime() + OUTBOX.leaseMs));
    expect(workerId).toBe("w1");
  });

  it("defaults to the configured batch size", async () => {
    const c = client();
    await claimBatch(c as never, "w1", T0);
    expect(c.$queryRaw.mock.calls[0]).toContain(OUTBOX.batchSize);
  });
});

describe("deliver", () => {
  const now = () => T0;

  it("records success and releases the lease", async () => {
    const c = client();

    await expect(deliver(c as never, event, "w1", now, vi.fn())).resolves.toBe("delivered");
    expect(c.outboxEvent.updateMany).toHaveBeenCalledWith({
      where: { id: "e1", leasedBy: "w1", completedAt: null },
      data: { leasedUntil: null, leasedBy: null, attempts: 1, lastError: null, completedAt: T0 },
    });
  });

  it("schedules a retry with backoff on a transient failure", async () => {
    const c = client();
    const dispatch = vi.fn().mockRejectedValue(new Error("render timeout"));

    await expect(deliver(c as never, event, "w1", now, dispatch, () => 0.5)).resolves.toBe("retried");
    expect(c.outboxEvent.updateMany.mock.calls[0][0].data).toEqual({
      leasedUntil: null,
      leasedBy: null,
      attempts: 1,
      lastError: "Error: render timeout",
      availableAt: new Date(T0.getTime() + 60_000),
    });
    expect(logWarn).toHaveBeenCalledWith("OUTBOX_RETRY", { eventId: "e1", type: "CERTIFICATE_ISSUED", attempts: 1 });
  });

  it("parks after the last attempt", async () => {
    const c = client();
    const dispatch = vi.fn().mockRejectedValue(new Error("still failing"));

    await expect(
      deliver(c as never, { ...event, attempts: OUTBOX.maxAttempts - 1 }, "w1", now, dispatch)
    ).resolves.toBe("parked");
    expect(c.outboxEvent.updateMany.mock.calls[0][0].data).toMatchObject({ parkedAt: T0, attempts: OUTBOX.maxAttempts });
    expect(logWarn).toHaveBeenCalledWith("OUTBOX_PARKED", expect.objectContaining({ eventId: "e1" }));
  });

  it("parks at once when retrying cannot help", async () => {
    const c = client();
    const dispatch = vi.fn().mockRejectedValue(new PermanentEventError("certificate gone"));

    await expect(deliver(c as never, event, "w1", now, dispatch)).resolves.toBe("parked");
    expect(c.outboxEvent.updateMany.mock.calls[0][0].data).toMatchObject({ attempts: 1, parkedAt: T0 });
  });

  it.each([
    ["success", false],
    ["failure", true],
  ])("writes nothing over a lease it no longer holds (%s)", async (_label, fails) => {
    // Built here, not in the table: the suite resets mocks before each test.
    const dispatch = fails ? vi.fn().mockRejectedValue(new Error("x")) : vi.fn();
    const c = client(0);

    await expect(deliver(c as never, event, "w1", now, dispatch)).resolves.toBe("lease_lost");
    expect(logWarn).not.toHaveBeenCalled();
  });

  it("never logs the payload", async () => {
    const c = client();
    await deliver(c as never, { ...event, payload: { userId: "learner_secret" } }, "w1", now, vi.fn().mockRejectedValue(new Error("x")));

    expect(JSON.stringify(logWarn.mock.calls)).not.toContain("learner_secret");
  });
});

describe("runOutbox", () => {
  it("delivers batches until none are left and tallies outcomes", async () => {
    const c = client();
    c.$queryRaw
      .mockResolvedValueOnce([event, { ...event, id: "e2" }])
      .mockResolvedValueOnce([{ ...event, id: "e3" }])
      .mockResolvedValueOnce([]);
    const dispatch = vi.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error("x")).mockResolvedValueOnce(undefined);

    const summary = await runOutbox({ client: c as never, workerId: "w1", now: () => T0, dispatch, random: () => 0.5 });

    expect(summary).toEqual({
      claimed: 3,
      delivered: 2,
      retried: 1,
      parked: 0,
      leaseLost: 0,
      stoppedForBudget: false,
      durationMs: 0,
    });
  });

  it("stops claiming when its time budget is spent", async () => {
    const c = client();
    c.$queryRaw.mockResolvedValue([event]);
    let clock = T0.getTime();
    const now = () => new Date((clock += 10_000));

    const summary = await runOutbox({ client: c as never, now, dispatch: vi.fn(), budgetMs: 45_000 });

    expect(summary.stoppedForBudget).toBe(true);
    expect(summary.claimed).toBeLessThan(5);
  });

  it("uses the shared client, a fresh worker id, and the real clock by default", async () => {
    const { dbMock } = await import("../support/db");
    (dbMock.$queryRaw as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    await expect(runOutbox()).resolves.toMatchObject({ claimed: 0, stoppedForBudget: false });
  });
});

describe("health, purge, replay, discard", () => {
  it("reports depth, oldest pending age, and parked count", async () => {
    const c = client();
    c.outboxEvent.count.mockResolvedValueOnce(5).mockResolvedValueOnce(2);
    c.outboxEvent.findFirst.mockResolvedValue({ occurredAt: new Date(T0.getTime() - 90_000) });

    await expect(outboxHealth(c as never, T0)).resolves.toEqual({ pending: 5, oldestPendingSeconds: 90, parked: 2 });
  });

  it("reports zero age for an empty queue", async () => {
    await expect(outboxHealth(client() as never, T0)).resolves.toMatchObject({ oldestPendingSeconds: 0 });
  });

  it("purges delivered events past retention and never parked ones", async () => {
    const c = client();

    await expect(purgeDelivered(c as never, T0)).resolves.toBe(4);
    expect(c.outboxEvent.deleteMany).toHaveBeenCalledWith({
      where: { completedAt: { lt: new Date(T0.getTime() - OUTBOX.retentionDays * 86_400_000) }, parkedAt: null },
    });
  });

  it("replays named or all parked events with a fresh budget", async () => {
    const c = client(3);

    await expect(replayParked(c as never, ["e1"], T0)).resolves.toBe(3);
    expect(c.outboxEvent.updateMany.mock.calls[0][0]).toEqual({
      where: { parkedAt: { not: null }, completedAt: null, id: { in: ["e1"] } },
      data: { parkedAt: null, attempts: 0, availableAt: T0, leasedUntil: null, leasedBy: null },
    });

    await replayParked(c as never, "all", T0);
    expect(c.outboxEvent.updateMany.mock.calls[1][0].where).toEqual({ parkedAt: { not: null }, completedAt: null });
  });

  it("discards parked events with the reason recorded", async () => {
    const c = client(1);

    await expect(discardParked(c as never, ["e1"], "consumer retired", T0)).resolves.toBe(1);
    expect(c.outboxEvent.updateMany.mock.calls[0][0].data).toEqual({ completedAt: T0, lastError: "discarded: consumer retired" });
  });

  it("uses the real clock by default", async () => {
    const { dbMock } = await import("../support/db");
    await expect(outboxHealth(dbMock as never)).resolves.toMatchObject({ pending: 0 });
    dbMock.outboxEvent.deleteMany.mockResolvedValue({ count: 0 });
    await expect(purgeDelivered(dbMock as never)).resolves.toBe(0);
    dbMock.outboxEvent.updateMany.mockResolvedValue({ count: 0 });
    await expect(replayParked(dbMock as never, "all")).resolves.toBe(0);
    await expect(discardParked(dbMock as never, ["e"], "r")).resolves.toBe(0);
  });

  it("lists parked events oldest first, without payloads", async () => {
    const c = { outboxEvent: { findMany: vi.fn().mockResolvedValue([]) } };

    await listParked(c as never);

    expect(c.outboxEvent.findMany).toHaveBeenCalledWith({
      where: { parkedAt: { not: null }, completedAt: null },
      orderBy: { parkedAt: "asc" },
      take: 50,
      select: { id: true, type: true, attempts: true, lastError: true, occurredAt: true, parkedAt: true },
    });
  });

});

describe("logRun", () => {
  const summary = { claimed: 1, delivered: 1, retried: 0, parked: 0, leaseLost: 0, stoppedForBudget: false, durationMs: 5 };

  it("is routine when nothing is parked", () => {
    logRun(summary, { pending: 0, oldestPendingSeconds: 0, parked: 0 }, 2);
    expect(logInfo).toHaveBeenCalledWith("OUTBOX_RUN", expect.objectContaining({ purged: 2 }));
    expect(logWarn).not.toHaveBeenCalled();
  });

  it("warns when anything is parked", () => {
    logRun(summary, { pending: 0, oldestPendingSeconds: 0, parked: 1 }, 0);
    expect(logWarn).toHaveBeenCalledWith("OUTBOX_RUN", expect.objectContaining({ parked: 1 }));
  });
});
