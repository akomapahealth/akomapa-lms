"use client";

import { Card } from "@/components/ui/card";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

interface ProgressDonutChartProps {
  completed: number;
  inProgress: number;
  notStarted: number;
  percentComplete: number;
}

const COLORS = {
  completed: "#059669",
  inProgress: "#0097b2",
  notStarted: "#e5e7eb",
};

export const ProgressDonutChart = ({
  completed,
  inProgress,
  notStarted,
  percentComplete,
}: ProgressDonutChartProps) => {
  const data = [
    { name: "Completed", value: completed, color: COLORS.completed },
    { name: "In Progress", value: inProgress, color: COLORS.inProgress },
    { name: "Not Started", value: notStarted, color: COLORS.notStarted },
  ].filter((d) => d.value > 0);

  // Show empty state if no modules
  if (data.length === 0) {
    data.push({ name: "No Modules", value: 1, color: COLORS.notStarted });
  }

  return (
    <Card className="p-4">
      <h3 className="font-semibold text-sm text-slate-700 mb-2">
        Module Progress
      </h3>
      <div className="relative h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={80}
              paddingAngle={2}
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={index} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number, name: string) => [
                `${value} module${value !== 1 ? "s" : ""}`,
                name,
              ]}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <p className="text-2xl font-bold text-slate-800">
              {percentComplete}%
            </p>
            <p className="text-xs text-slate-500">Complete</p>
          </div>
        </div>
      </div>
      <div className="flex justify-center gap-4 mt-2 text-xs text-slate-600">
        <div className="flex items-center gap-1">
          <div
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: COLORS.completed }}
          />
          <span>{completed} Done</span>
        </div>
        <div className="flex items-center gap-1">
          <div
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: COLORS.inProgress }}
          />
          <span>{inProgress} Active</span>
        </div>
        <div className="flex items-center gap-1">
          <div
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: COLORS.notStarted }}
          />
          <span>{notStarted} Pending</span>
        </div>
      </div>
    </Card>
  );
};
