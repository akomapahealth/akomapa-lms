"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { type StudentActivity } from "@/actions/get-admin-analytics";

interface StudentActivityChartProps {
  data: StudentActivity[];
}

export const StudentActivityChart = ({ data }: StudentActivityChartProps) => {
  return (
    <Card className="border-border">
      <CardHeader>
        <CardTitle className="text-base">Student Activity (14 days)</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" fontSize={12} />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Legend />
            <Area
              type="monotone"
              dataKey="topicsCompleted"
              name="Topics Completed"
              stroke="hsl(var(--primary))"
              fill="hsl(var(--primary))"
              fillOpacity={0.2}
              strokeWidth={2}
            />
            <Area
              type="monotone"
              dataKey="quizzesTaken"
              name="Quizzes Taken"
              stroke="hsl(var(--akomapa-gold))"
              fill="hsl(var(--akomapa-gold))"
              fillOpacity={0.2}
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};
