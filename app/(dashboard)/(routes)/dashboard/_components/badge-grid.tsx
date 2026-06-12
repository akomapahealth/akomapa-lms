"use client";

import { BadgeDisplay } from "@/components/badge-display";

interface BadgeData {
  id: string;
  name: string;
  description: string;
  type: string;
  imageUrl: string | null;
  earned: boolean;
  earnedAt: Date | null;
}

interface BadgeGridProps {
  badges: BadgeData[];
}

export const BadgeGrid = ({ badges }: BadgeGridProps) => {
  const earnedCount = badges.filter((b) => b.earned).length;

  return (
    <div className="rounded-lg border bg-white p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-slate-800">Badges</h3>
        <span className="text-xs text-slate-500">
          {earnedCount}/{badges.length} earned
        </span>
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 gap-2">
        {badges.map((badge) => (
          <BadgeDisplay
            key={badge.id}
            name={badge.name}
            description={badge.description}
            type={badge.type}
            earned={badge.earned}
            earnedAt={badge.earnedAt}
            imageUrl={badge.imageUrl}
          />
        ))}
      </div>
    </div>
  );
};
