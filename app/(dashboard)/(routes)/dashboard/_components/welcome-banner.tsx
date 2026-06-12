import { currentUser } from "@clerk/nextjs/server";

interface WelcomeBannerProps {
  inProgressCount: number;
  completedCount: number;
}

export const WelcomeBanner = async ({
  inProgressCount,
  completedCount,
}: WelcomeBannerProps) => {
  const user = await currentUser();
  const firstName = user?.firstName || "Student";

  return (
    <div className="rounded-xl bg-gradient-to-r from-akomapa-teal to-akomapa-teal-dark p-6 md:p-8 text-white">
      <h1 className="text-2xl md:text-3xl font-bold">
        Welcome, {firstName}
      </h1>
      <p className="mt-1 text-white/80 text-sm md:text-base">
        Continue your GHELP journey
      </p>
      <div className="mt-4 flex gap-4 text-sm">
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-2 rounded-full bg-akomapa-gold" />
          <span>{inProgressCount} in progress</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-2 rounded-full bg-emerald-300" />
          <span>{completedCount} completed</span>
        </div>
      </div>
    </div>
  );
};
