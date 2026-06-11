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
    <Card className="border-slate-200">
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
              stroke="#0d9488"
              fill="#0d9488"
              fillOpacity={0.2}
              strokeWidth={2}
            />
            <Area
              type="monotone"
              dataKey="quizzesTaken"
              name="Quizzes Taken"
              stroke="#ebb92b"
              fill="#ebb92b"
              fillOpacity={0.2}
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};
