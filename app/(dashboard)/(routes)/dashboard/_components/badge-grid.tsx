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
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-foreground">Badges</h3>
        <span className="text-xs text-muted-foreground">
          {earnedCount}/{badges.length} earned
        </span>
      </div>
      <div className="flex snap-x snap-mandatory gap-2 overflow-x-auto pb-1 [&>*]:shrink-0 [&>*]:snap-start sm:grid sm:grid-cols-4 sm:overflow-visible sm:pb-0 md:grid-cols-5 lg:grid-cols-7">
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
