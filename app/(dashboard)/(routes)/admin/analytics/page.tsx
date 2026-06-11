import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { isAdmin } from "@/lib/roles";
import { getAdminAnalytics } from "@/actions/get-admin-analytics";
import { getAnalytics } from "@/actions/get-analytics";
import { DataCard } from "@/app/(dashboard)/(routes)/teacher/analytics/_components/data-card";

import { EffectivenessChart } from "./_components/effectiveness-chart";
import { EnrollmentTrendChart } from "./_components/enrollment-trend-chart";
import { ModuleDropoffChart } from "./_components/module-dropoff-chart";
import { BadgeDistributionChart } from "./_components/badge-distribution-chart";
import { EngagementStats } from "./_components/engagement-stats";
import { StudentActivityChart } from "./_components/student-activity-chart";

const AdminAnalyticsPage = async () => {
  const { userId } = await auth();

  if (!userId || !(await isAdmin(userId))) {
    return redirect("/");
  }

  const [analytics, { totalRevenue, totalSales }] = await Promise.all([
    getAdminAnalytics(),
    getAnalytics(userId),
  ]);

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-slate-800">Analytics</h1>

      {/* Revenue cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <DataCard label="Total Revenue" value={totalRevenue} shouldFormat />
        <DataCard label="Total Sales" value={totalSales} />
      </div>

      {/* Engagement */}
      <EngagementStats data={analytics.engagement} />

      {/* Charts grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <EffectivenessChart data={analytics.effectiveness} />
        <EnrollmentTrendChart data={analytics.enrollmentTrends} />
        <ModuleDropoffChart data={analytics.moduleDropoff} />
        <BadgeDistributionChart data={analytics.badgeDistribution} />
      </div>

      {/* Student activity */}
      <StudentActivityChart data={analytics.studentActivity} />
    </div>
  );
};

export default AdminAnalyticsPage;
