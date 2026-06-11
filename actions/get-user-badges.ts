import { db } from "@/lib/db";

export async function getUserBadges(userId: string) {
  const [allBadges, earnedBadges] = await Promise.all([
    db.badge.findMany({ orderBy: { createdAt: "asc" } }),
    db.userBadge.findMany({
      where: { userId },
      select: { badgeId: true, earnedAt: true },
    }),
  ]);

  const earnedMap = new Map(
    earnedBadges.map((ub) => [ub.badgeId, ub.earnedAt])
  );

  return allBadges.map((badge) => ({
    ...badge,
    earned: earnedMap.has(badge.id),
    earnedAt: earnedMap.get(badge.id) ?? null,
  }));
}
