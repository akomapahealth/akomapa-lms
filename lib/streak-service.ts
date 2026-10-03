import type { LearningStreak, Prisma } from "@prisma/client";

import { db } from "@/lib/db";

/**
 * Learning streaks (#49, ADR 0004).
 *
 * `nextStreak` is the rule, pure: given the stored streak and the moment of
 * activity, it returns the streak to store. `recordStreakActivity` applies it
 * in the caller's transaction, so a Topic completion and the streak it earns
 * commit together. Before, the streak was written in its own statements after
 * the progress write, and a failure between the two left them disagreeing.
 *
 * Days are UTC calendar days, as the server has always counted them. Counting
 * them in the learner's timezone is #60.
 */

export interface StreakState {
  currentStreak: number;
  longestStreak: number;
  lastActivityDate: Date | null;
}

/** Midnight UTC on the day containing `moment`. */
export function utcDay(moment: Date): Date {
  return new Date(Date.UTC(moment.getUTCFullYear(), moment.getUTCMonth(), moment.getUTCDate()));
}

const DAY_MS = 86_400_000;

/**
 * The streak after activity at `now`.
 *
 * - Already active today: unchanged.
 * - Last active yesterday: one more day.
 * - Anything else (a gap, or no activity on record): a new streak of one.
 * The longest streak never decreases.
 */
export function nextStreak(previous: StreakState | null, now: Date): StreakState & { changed: boolean } {
  const today = utcDay(now);
  const last = previous?.lastActivityDate ? utcDay(previous.lastActivityDate) : null;

  if (previous && last && last.getTime() === today.getTime()) {
    return { ...previous, lastActivityDate: today, changed: false };
  }

  const consecutive = previous && last && today.getTime() - last.getTime() === DAY_MS;
  const currentStreak = consecutive ? previous.currentStreak + 1 : 1;

  return {
    currentStreak,
    longestStreak: Math.max(previous?.longestStreak ?? 0, currentStreak),
    lastActivityDate: today,
    changed: true,
  };
}

type StreakClient = Pick<Prisma.TransactionClient, "learningStreak">;

/**
 * Records learning activity for a learner and returns the current streak.
 *
 * Safe under concurrency without a lock: the streak changes at most once per
 * UTC day, so two activities racing on the same day read the same row and
 * compute the same next value, and whichever write lands second writes what
 * the first already wrote.
 */
export async function recordStreakActivity(
  client: StreakClient,
  userId: string,
  now: Date = new Date()
): Promise<number> {
  const existing: LearningStreak | null = await client.learningStreak.findUnique({
    where: { userId },
  });
  const next = nextStreak(existing, now);

  if (!next.changed) return next.currentStreak;

  const data = {
    currentStreak: next.currentStreak,
    longestStreak: next.longestStreak,
    lastActivityDate: next.lastActivityDate,
  };
  await client.learningStreak.upsert({
    where: { userId },
    create: { userId, ...data },
    update: data,
  });

  return next.currentStreak;
}

/**
 * Records activity outside any wider transaction. Kept for callers that have
 * no transaction of their own; the completion command uses
 * `recordStreakActivity` with its transaction instead.
 */
export async function updateStreak(userId: string, now: Date = new Date()): Promise<number> {
  return recordStreakActivity(db, userId, now);
}
