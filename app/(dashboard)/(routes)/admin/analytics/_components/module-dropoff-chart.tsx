"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { type ModuleDropoff } from "@/actions/get-admin-analytics";

interface ModuleDropoffChartProps {
  data: ModuleDropoff[];
}

export const ModuleDropoffChart = ({ data }: ModuleDropoffChartProps) => {
  return (
    <Card className="border-border">
      <CardHeader>
        <CardTitle className="text-base">Module Completion Rate</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground/70 text-center py-8">
            No module data available
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" domain={[0, 100]} />
              <YAxis
                dataKey="moduleTitle"
                type="category"
                width={150}
                fontSize={12}
              />
              <Tooltip formatter={(value: number) => `${value}%`} />
              <Bar
                dataKey="completionRate"
                name="Completion %"
                fill="hsl(var(--primary))"
                radius={[0, 4, 4, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
};
