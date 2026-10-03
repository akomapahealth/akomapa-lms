import { describe, expect, it, vi } from "vitest";

import { aLearningStreak } from "./support/builders";
import { dbMock } from "./support/db";
import { freezeTimeAt } from "./support/time";

vi.mock("@/lib/db", async () => ({
  db: (await import("./support/db")).dbMock,
}));

const { nextStreak, recordStreakActivity, updateStreak, utcDay } = await import(
  "@/lib/streak-service"
);

/**
 * The streak rule is small but every branch of it is a date comparison, and
 * date comparisons are where this codebase has historically been wrong. Since
 * #49 the rule is the pure `nextStreak`, tested against explicit instants, and
 * `recordStreakActivity` applies it in the caller's transaction.
 */
const at = (iso: string) => new Date(iso);
const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const NOW = at("2026-03-15T10:30:00.000Z");

describe("nextStreak", () => {
  it("leaves the streak untouched when activity was already recorded today", () => {
    expect(
      nextStreak({ currentStreak: 4, longestStreak: 6, lastActivityDate: day("2026-03-15") }, NOW)
    ).toEqual({ currentStreak: 4, longestStreak: 6, lastActivityDate: day("2026-03-15"), changed: false });
  });

  it("increments on a consecutive day", () => {
    expect(
      nextStreak({ currentStreak: 4, longestStreak: 4, lastActivityDate: day("2026-03-14") }, NOW)
    ).toMatchObject({ currentStreak: 5, longestStreak: 5, lastActivityDate: day("2026-03-15"), changed: true });
  });

  it("resets to 1 after a gap, keeping the longest", () => {
    expect(
      nextStreak({ currentStreak: 9, longestStreak: 12, lastActivityDate: day("2026-03-10") }, NOW)
    ).toMatchObject({ currentStreak: 1, longestStreak: 12 });
  });

  it("starts at 1 for a first-time learner", () => {
    expect(nextStreak(null, NOW)).toEqual({
      currentStreak: 1,
      longestStreak: 1,
      lastActivityDate: day("2026-03-15"),
      changed: true,
    });
  });

  it("starts at 1 when the record has never recorded activity", () => {
    expect(nextStreak({ currentStreak: 3, longestStreak: 3, lastActivityDate: null }, NOW)).toMatchObject({
      currentStreak: 1,
      longestStreak: 3,
    });
  });

  it("advances the longest streak when the current one overtakes it", () => {
    expect(
      nextStreak({ currentStreak: 5, longestStreak: 5, lastActivityDate: day("2026-03-14") }, NOW).longestStreak
    ).toBe(6);
  });

  it.each([
    ["a month boundary", "2026-03-01T00:00:01.000Z", "2026-02-28", 3],
    ["a year boundary", "2026-01-01T12:00:00.000Z", "2025-12-31", 3],
    // 23:59:59 today and 00:00 yesterday are one calendar day apart, though
    // nearly 48 hours apart as instants.
    ["the time of day", "2026-03-15T23:59:59.999Z", "2026-03-14", 3],
  ])("counts %s as consecutive", (_label, now, last, expected) => {
    expect(
      nextStreak({ currentStreak: 2, longestStreak: 2, lastActivityDate: day(last) }, at(now)).currentStreak
    ).toBe(expected);
  });

  it("resets rather than credits a streak when the stored date is in the future", () => {
    // Clock skew or a bad backfill must not be able to inflate a streak.
    expect(
      nextStreak({ currentStreak: 5, longestStreak: 5, lastActivityDate: day("2026-03-16") }, NOW).currentStreak
    ).toBe(1);
  });

  it("counts days, not activities: two activities on one day earn one day", () => {
    // Two completions racing on the same day both read yesterday and both
    // compute 5. That is the rule, not a lost update: a streak is a count of
    // consecutive days, so 6 would be the defect.
    const yesterday = { currentStreak: 4, longestStreak: 4, lastActivityDate: day("2026-03-14") };

    expect(nextStreak(yesterday, at("2026-03-15T08:00:00Z")).currentStreak).toBe(5);
    expect(nextStreak(yesterday, at("2026-03-15T08:00:00.001Z")).currentStreak).toBe(5);
  });
});

describe("utcDay", () => {
  it("is midnight UTC whatever the time of day", () => {
    expect(utcDay(at("2026-03-15T23:59:59.999Z"))).toEqual(day("2026-03-15"));
  });
});

describe("recordStreakActivity", () => {
  function client(existing: ReturnType<typeof aLearningStreak> | null) {
    return {
      learningStreak: {
        findUnique: vi.fn().mockResolvedValue(existing),
        upsert: vi.fn().mockResolvedValue({}),
      },
    };
  }

  it("writes the next streak through the client it is given", async () => {
    const tx = client(aLearningStreak({ currentStreak: 4, longestStreak: 4, lastActivityDate: day("2026-03-14") }));

    await expect(recordStreakActivity(tx as never, "user_1", NOW)).resolves.toBe(5);
    expect(tx.learningStreak.upsert).toHaveBeenCalledWith({
      where: { userId: "user_1" },
      create: { userId: "user_1", currentStreak: 5, longestStreak: 5, lastActivityDate: day("2026-03-15") },
      update: { currentStreak: 5, longestStreak: 5, lastActivityDate: day("2026-03-15") },
    });
  });

  it("writes nothing when today is already counted", async () => {
    const tx = client(aLearningStreak({ currentStreak: 4, longestStreak: 4, lastActivityDate: day("2026-03-15") }));

    await expect(recordStreakActivity(tx as never, "user_1", NOW)).resolves.toBe(4);
    expect(tx.learningStreak.upsert).not.toHaveBeenCalled();
  });

  it("creates the record for a first-time learner", async () => {
    const tx = client(null);

    await expect(recordStreakActivity(tx as never, "user_1", NOW)).resolves.toBe(1);
    expect(tx.learningStreak.upsert).toHaveBeenCalled();
  });

  it("uses the shared client and the real clock when called without a transaction", async () => {
    freezeTimeAt("2026-03-15T10:30:00.000Z");
    dbMock.learningStreak.findUnique.mockResolvedValue(null);
    dbMock.learningStreak.upsert.mockResolvedValue({});

    await expect(updateStreak("user_1")).resolves.toBe(1);
    expect(dbMock.learningStreak.upsert).toHaveBeenCalled();
  });
});

/**
 * Characterisation. This pins a known limitation so the issue that fixes it has
 * a failing test to turn green. Delete it there rather than here.
 */
describe("known defects", () => {
  it("counts UTC calendar days, not the learner's (#60)", () => {
    // 00:30 UTC on the 15th is still the evening of the 14th for a learner in
    // UTC-5, so the same action can land on either side of a streak boundary
    // depending on where the learner is.
    expect(
      nextStreak(
        { currentStreak: 3, longestStreak: 3, lastActivityDate: day("2026-03-14") },
        at("2026-03-15T00:30:00.000Z")
      ).currentStreak
    ).toBe(4);
  });
});
