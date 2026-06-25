"use client";

import { Card } from "@/components/ui/card";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { useRouter, useSearchParams } from "next/navigation";
import { type CompletionDataPoint } from "@/actions/get-completion-timeline";

interface TimeProgressChartProps {
  dataPoints: CompletionDataPoint[];
  currentProgress: number;
  progressChange: number;
  averageProgress: number;
  peakProgress: number;
  period: "weekly" | "monthly";
}

export const TimeProgressChart = ({
  dataPoints,
  currentProgress,
  progressChange,
  averageProgress,
  peakProgress,
  period,
}: TimeProgressChartProps) => {
  const router = useRouter();
  const searchParams = useSearchParams();

  const togglePeriod = (newPeriod: "weekly" | "monthly") => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("period", newPeriod);
    router.push(`/?${params.toString()}`);
  };

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold text-sm text-foreground">
            Progress Timeline
          </h3>
          <p className="text-xs text-muted-foreground">
            Completion over time
          </p>
        </div>
        <div className="flex rounded-md border border-border overflow-hidden text-xs">
          <button
            onClick={() => togglePeriod("weekly")}
            className={`px-3 py-1.5 transition-colors ${
              period === "weekly"
                ? "bg-akomapa-teal text-white"
                : "bg-card text-muted-foreground hover:bg-muted/50"
            }`}
          >
            Weekly
          </button>
          <button
            onClick={() => togglePeriod("monthly")}
            className={`px-3 py-1.5 transition-colors ${
              period === "monthly"
                ? "bg-akomapa-teal text-white"
                : "bg-card text-muted-foreground hover:bg-muted/50"
            }`}
          >
            Monthly
          </button>
        </div>
      </div>

      {dataPoints.length === 0 ? (
        <div className="flex items-center justify-center h-[200px] text-sm text-muted-foreground/70">
          No progress data yet
        </div>
      ) : (
        <div className="h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={dataPoints}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11 }}
                stroke="hsl(var(--muted-foreground))"
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fontSize: 11 }}
                stroke="hsl(var(--muted-foreground))"
                tickFormatter={(v) => `${v}%`}
              />
              <Tooltip
                formatter={(value: number) => [`${value}%`, "Completion"]}
              />
              <Line
                type="monotone"
                dataKey="completionPercent"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={{ fill: "hsl(var(--primary))", r: 3 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 pt-3 border-t border-border/50">
        <div>
          <p className="text-xs text-muted-foreground">Current</p>
          <p className="text-sm font-semibold text-foreground">
            {currentProgress}%
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Change</p>
          <p
            className={`text-sm font-semibold ${
              progressChange > 0
                ? "text-success"
                : progressChange < 0
                  ? "text-red-500"
                  : "text-foreground"
            }`}
          >
            {progressChange > 0 ? "+" : ""}
            {progressChange}%
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Average</p>
          <p className="text-sm font-semibold text-foreground">
            {averageProgress}%
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Peak</p>
          <p className="text-sm font-semibold text-foreground">
            {peakProgress}%
          </p>
        </div>
      </div>
    </Card>
  );
};
