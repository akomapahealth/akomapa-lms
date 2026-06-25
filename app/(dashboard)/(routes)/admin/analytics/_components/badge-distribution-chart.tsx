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
import { type BadgeDistribution } from "@/actions/get-admin-analytics";

interface BadgeDistributionChartProps {
  data: BadgeDistribution[];
}

export const BadgeDistributionChart = ({
  data,
}: BadgeDistributionChartProps) => {
  return (
    <Card className="border-border">
      <CardHeader>
        <CardTitle className="text-base">Badge Distribution</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground/70 text-center py-8">
            No badges earned yet
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" fontSize={11} angle={-30} textAnchor="end" height={60} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar
                dataKey="count"
                name="Earned"
                fill="hsl(var(--akomapa-gold))"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
};
