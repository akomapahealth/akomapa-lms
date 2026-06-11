import { MessageSquare, MessagesSquare, Users } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { type EngagementStats as EngagementStatsType } from "@/actions/get-admin-analytics";

interface EngagementStatsProps {
  data: EngagementStatsType;
}

export const EngagementStats = ({ data }: EngagementStatsProps) => {
  const stats = [
    {
      label: "Forum Posts",
      value: data.totalPosts,
      icon: MessageSquare,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      label: "Comments",
      value: data.totalComments,
      icon: MessagesSquare,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
    },
    {
      label: "Active Users",
      value: data.activeUsers,
      icon: Users,
      color: "text-amber-600",
      bg: "bg-amber-50",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {stats.map((stat) => (
        <Card key={stat.label} className="border-slate-200">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${stat.bg}`}>
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-800">
                  {stat.value}
                </p>
                <p className="text-sm text-slate-500">{stat.label}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
