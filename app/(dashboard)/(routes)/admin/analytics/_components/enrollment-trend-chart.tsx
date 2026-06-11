"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { type EnrollmentTrend } from "@/actions/get-admin-analytics";

interface EnrollmentTrendChartProps {
  data: EnrollmentTrend[];
}

export const EnrollmentTrendChart = ({ data }: EnrollmentTrendChartProps) => {
  return (
    <Card className="border-slate-200">
      <CardHeader>
        <CardTitle className="text-base">Enrollment Trends</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" fontSize={12} />
            <YAxis />
            <Tooltip />
            <Line
              type="monotone"
              dataKey="count"
              name="Enrollments"
              stroke="#0d9488"
              strokeWidth={2}
              dot={{ fill: "#0d9488" }}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};
