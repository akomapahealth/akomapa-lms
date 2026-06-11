import { db } from "@/lib/db";

/**
 * Updates the learning streak for a user.
 * - If last activity was yesterday: increment streak
 * - If last activity was today: no change
 * - Otherwise: reset streak to 1
 *
 * Returns the current streak count.
 */
export async function updateStreak(userId: string): Promise<number> {
  const now = new Date();
  const today = stripTime(now);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const streak = await db.learningStreak.upsert({
    where: { userId },
    create: {
      userId,
      currentStreak: 1,
      longestStreak: 1,
      lastActivityDate: today,
    },
    update: {},
  });

  const lastActivity = streak.lastActivityDate
    ? stripTime(streak.lastActivityDate)
    : null;

  // Already tracked today — no change
  if (lastActivity && lastActivity.getTime() === today.getTime()) {
    return streak.currentStreak;
  }

  let newStreak: number;

  if (lastActivity && lastActivity.getTime() === yesterday.getTime()) {
    // Consecutive day — increment
    newStreak = streak.currentStreak + 1;
  } else {
    // Gap in activity — reset to 1
    newStreak = 1;
  }

  const newLongest = Math.max(streak.longestStreak, newStreak);

  await db.learningStreak.update({
    where: { userId },
    data: {
      currentStreak: newStreak,
      longestStreak: newLongest,
      lastActivityDate: today,
    },
  });

  return newStreak;
}

function stripTime(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}
