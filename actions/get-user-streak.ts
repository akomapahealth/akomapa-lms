import { db } from "@/lib/db";

export async function getUserStreak(userId: string) {
  const streak = await db.learningStreak.findUnique({
    where: { userId },
  });

  return {
    currentStreak: streak?.currentStreak ?? 0,
    longestStreak: streak?.longestStreak ?? 0,
    lastActivityDate: streak?.lastActivityDate ?? null,
  };
}
