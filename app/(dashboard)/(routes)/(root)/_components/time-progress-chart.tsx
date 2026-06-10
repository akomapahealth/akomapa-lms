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
          <h3 className="font-semibold text-sm text-slate-700">
            Progress Timeline
          </h3>
          <p className="text-xs text-slate-500">
            Completion over time
          </p>
        </div>
        <div className="flex rounded-md border border-slate-200 overflow-hidden text-xs">
          <button
            onClick={() => togglePeriod("weekly")}
            className={`px-3 py-1.5 transition-colors ${
              period === "weekly"
                ? "bg-akomapa-teal text-white"
                : "bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            Weekly
          </button>
          <button
            onClick={() => togglePeriod("monthly")}
            className={`px-3 py-1.5 transition-colors ${
              period === "monthly"
                ? "bg-akomapa-teal text-white"
                : "bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            Monthly
          </button>
        </div>
      </div>

      {dataPoints.length === 0 ? (
        <div className="flex items-center justify-center h-[200px] text-sm text-slate-400">
          No progress data yet
        </div>
      ) : (
        <div className="h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={dataPoints}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11 }}
                stroke="#94a3b8"
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fontSize: 11 }}
                stroke="#94a3b8"
                tickFormatter={(v) => `${v}%`}
              />
              <Tooltip
                formatter={(value: number) => [`${value}%`, "Completion"]}
              />
              <Line
                type="monotone"
                dataKey="completionPercent"
                stroke="#0097b2"
                strokeWidth={2}
                dot={{ fill: "#0097b2", r: 3 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 pt-3 border-t border-slate-100">
        <div>
          <p className="text-xs text-slate-500">Current</p>
          <p className="text-sm font-semibold text-slate-700">
            {currentProgress}%
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Change</p>
          <p
            className={`text-sm font-semibold ${
              progressChange > 0
                ? "text-emerald-600"
                : progressChange < 0
                  ? "text-red-500"
                  : "text-slate-700"
            }`}
          >
            {progressChange > 0 ? "+" : ""}
            {progressChange}%
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Average</p>
          <p className="text-sm font-semibold text-slate-700">
            {averageProgress}%
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Peak</p>
          <p className="text-sm font-semibold text-slate-700">
            {peakProgress}%
          </p>
        </div>
      </div>
    </Card>
  );
};
