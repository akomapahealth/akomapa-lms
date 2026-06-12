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
      color: "text-success",
      bg: "bg-success/10",
    },
    {
      label: "Active Users",
      value: data.activeUsers,
      icon: Users,
      color: "text-warning",
      bg: "bg-warning/10",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {stats.map((stat) => (
        <Card key={stat.label} className="border-border">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${stat.bg}`}>
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {stat.value}
                </p>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
