"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { type EffectivenessData } from "@/actions/get-admin-analytics";

interface EffectivenessChartProps {
  data: EffectivenessData[];
}

export const EffectivenessChart = ({ data }: EffectivenessChartProps) => {
  return (
    <Card className="border-slate-200">
      <CardHeader>
        <CardTitle className="text-base">Program Effectiveness</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-8">
            No test data available yet
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="courseTitle" fontSize={12} />
              <YAxis domain={[0, 100]} />
              <Tooltip />
              <Legend />
              <Bar dataKey="preTestAvg" name="Pre-Test Avg" fill="#94a3b8" />
              <Bar dataKey="postTestAvg" name="Post-Test Avg" fill="#0d9488" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
};
