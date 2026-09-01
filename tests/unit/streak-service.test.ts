import { describe, expect, it, vi } from "vitest";

import { aLearningStreak } from "./support/builders";
import { dbMock } from "./support/db";
import { dayStart, freezeTimeAt } from "./support/time";

vi.mock("@/lib/db", async () => ({
  db: (await import("./support/db")).dbMock,
}));

const { updateStreak } = await import("@/lib/streak-service");

/**
 * The streak rule is small but every branch of it is a date comparison, and
 * date comparisons are where this codebase has historically been wrong. The
 * clock is pinned for every case so a run at 23:59 UTC behaves like a run at
 * noon.
 *
 * Related work: #83 (idempotency and concurrency) and #60 (timezone-safe
 * progress dates) own the fixes characterised at the end of this file.
 */
const NOW = "2026-03-15T10:30:00.000Z";
const TODAY = dayStart("2026-03-15");
const YESTERDAY = dayStart("2026-03-14");

function arriveWith(streak: Parameters<typeof aLearningStreak>[0]) {
  dbMock.learningStreak.upsert.mockResolvedValue(aLearningStreak(streak));
  dbMock.learningStreak.update.mockResolvedValue(aLearningStreak(streak));
}

describe("updateStreak", () => {
  it("leaves the streak untouched when activity was already recorded today", async () => {
    freezeTimeAt(NOW);
    arriveWith({ currentStreak: 4, longestStreak: 9, lastActivityDate: TODAY });

    await expect(updateStreak("user_1")).resolves.toBe(4);

    // The second write is what makes the operation non-idempotent, so its
    // absence is the actual assertion here.
    expect(dbMock.learningStreak.update).not.toHaveBeenCalled();
  });

  it("increments on a consecutive day", async () => {
    freezeTimeAt(NOW);
    arriveWith({ currentStreak: 4, longestStreak: 9, lastActivityDate: YESTERDAY });

    await expect(updateStreak("user_1")).resolves.toBe(5);

    expect(dbMock.learningStreak.update).toHaveBeenCalledWith({
      where: { userId: "user_1" },
      data: { currentStreak: 5, longestStreak: 9, lastActivityDate: TODAY },
    });
  });

  it("resets to 1 after a gap", async () => {
    freezeTimeAt(NOW);
    arriveWith({
      currentStreak: 30,
      longestStreak: 30,
      lastActivityDate: dayStart("2026-03-13"),
    });

    await expect(updateStreak("user_1")).resolves.toBe(1);

    expect(dbMock.learningStreak.update).toHaveBeenCalledWith({
      where: { userId: "user_1" },
      data: { currentStreak: 1, longestStreak: 30, lastActivityDate: TODAY },
    });
  });

  it("resets to 1 when the record has never recorded activity", async () => {
    freezeTimeAt(NOW);
    arriveWith({ currentStreak: 0, longestStreak: 0, lastActivityDate: null });

    await expect(updateStreak("user_1")).resolves.toBe(1);
  });

  it("creates a record for a first-time learner and counts it as day one", async () => {
    freezeTimeAt(NOW);
    arriveWith({ currentStreak: 1, longestStreak: 1, lastActivityDate: TODAY });

    await expect(updateStreak("user_1")).resolves.toBe(1);

    expect(dbMock.learningStreak.upsert).toHaveBeenCalledWith({
      where: { userId: "user_1" },
      create: {
        userId: "user_1",
        currentStreak: 1,
        longestStreak: 1,
        lastActivityDate: TODAY,
      },
      update: {},
    });
  });

  describe("longest streak", () => {
    it("advances when the current streak overtakes it", async () => {
      freezeTimeAt(NOW);
      arriveWith({ currentStreak: 9, longestStreak: 9, lastActivityDate: YESTERDAY });

      await updateStreak("user_1");

      expect(dbMock.learningStreak.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ currentStreak: 10, longestStreak: 10 }),
        })
      );
    });

    it("never decreases, including when the current streak resets", async () => {
      freezeTimeAt(NOW);
      arriveWith({
        currentStreak: 30,
        longestStreak: 30,
        lastActivityDate: dayStart("2026-01-01"),
      });

      await updateStreak("user_1");

      expect(dbMock.learningStreak.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ currentStreak: 1, longestStreak: 30 }),
        })
      );
    });
  });

  describe("boundaries", () => {
    it("counts a month boundary as consecutive", async () => {
      freezeTimeAt("2026-03-01T00:00:01.000Z");
      arriveWith({
        currentStreak: 2,
        longestStreak: 2,
        lastActivityDate: dayStart("2026-02-28"),
      });

      await expect(updateStreak("user_1")).resolves.toBe(3);
    });

    it("counts a year boundary as consecutive", async () => {
      freezeTimeAt("2026-01-01T12:00:00.000Z");
      arriveWith({
        currentStreak: 7,
        longestStreak: 7,
        lastActivityDate: dayStart("2025-12-31"),
      });

      await expect(updateStreak("user_1")).resolves.toBe(8);
    });

    it("ignores the time of day when comparing calendar dates", async () => {
      // 23:59:59 today and 00:00:00 yesterday are one calendar day apart even
      // though they are nearly 48 hours apart as instants.
      freezeTimeAt("2026-03-15T23:59:59.999Z");
      arriveWith({
        currentStreak: 1,
        longestStreak: 1,
        lastActivityDate: new Date("2026-03-14T00:00:00.000Z"),
      });

      await expect(updateStreak("user_1")).resolves.toBe(2);
    });

    it("resets rather than credits a streak when the stored date is in the future", async () => {
      // Clock skew or a bad backfill must not be able to inflate a streak.
      freezeTimeAt(NOW);
      arriveWith({
        currentStreak: 5,
        longestStreak: 5,
        lastActivityDate: dayStart("2026-03-16"),
      });

      await expect(updateStreak("user_1")).resolves.toBe(1);
    });
  });

  /**
   * Characterisation tests. These pin defects that exist today so that the
   * issues which fix them have a failing test to turn green. Delete them there
   * rather than here.
   */
  describe("known defects", () => {
    it("derives the new value from an earlier read, so concurrent calls lose an update (#83)", async () => {
      freezeTimeAt(NOW);
      arriveWith({ currentStreak: 4, longestStreak: 4, lastActivityDate: YESTERDAY });

      const [first, second] = await Promise.all([
        updateStreak("user_1"),
        updateStreak("user_1"),
      ]);

      // Both callers read `currentStreak: 4` before either wrote, so both
      // compute 5 and the second write silently overwrites the first. An
      // atomic `{ increment: 1 }` would produce 5 and 6.
      expect([first, second]).toEqual([5, 5]);
      expect(dbMock.learningStreak.update).toHaveBeenCalledTimes(2);
    });

    it("compares dates in the server's local timezone, not the learner's (#60)", async () => {
      // The service strips time with `new Date(y, m, d)`, which is server-local.
      // Under TZ=UTC (pinned by the suite) an instant just after midnight UTC is
      // "today"; for a learner in UTC-5 it is still the previous evening, so the
      // same action can land on either side of a streak boundary depending on
      // where the server runs.
      freezeTimeAt("2026-03-15T00:30:00.000Z");
      arriveWith({ currentStreak: 3, longestStreak: 3, lastActivityDate: YESTERDAY });

      await expect(updateStreak("user_1")).resolves.toBe(4);
      expect(process.env.TZ).toBe("UTC");
    });
  });
});
