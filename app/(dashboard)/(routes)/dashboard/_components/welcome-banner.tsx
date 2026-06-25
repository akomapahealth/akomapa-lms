import { currentUser } from "@clerk/nextjs/server";

import { StreakCounter } from "./streak-counter";

interface WelcomeBannerProps {
  inProgressCount: number;
  completedCount: number;
  currentStreak: number;
}

export const WelcomeBanner = async ({
  inProgressCount,
  completedCount,
  currentStreak,
}: WelcomeBannerProps) => {
  const user = await currentUser();
  const firstName = user?.firstName || "Student";

  return (
    <div className="rounded-2xl bg-surface-deep p-6 text-surface-deep-foreground shadow-soft md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-akomapa-gold">
            Nya Akomapa
          </p>
          <h1 className="font-display mt-2 text-2xl font-semibold md:text-3xl">
            Welcome back, {firstName}
          </h1>
          <p className="mt-1 text-sm text-surface-deep-foreground/75 md:text-base">
            Continue your GHELP journey
          </p>
        </div>
        <StreakCounter currentStreak={currentStreak} />
      </div>
      <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm">
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-2 rounded-full bg-akomapa-gold" />
          <span>{inProgressCount} in progress</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-2 rounded-full bg-success" />
          <span>{completedCount} completed</span>
        </div>
      </div>
    </div>
  );
};
