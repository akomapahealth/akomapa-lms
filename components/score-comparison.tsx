"use client";

import { ArrowUp, ArrowDown, Minus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface ScoreComparisonProps {
  preTestScore: number | null;
  postTestScore: number | null;
}

export const ScoreComparison = ({
  preTestScore,
  postTestScore,
}: ScoreComparisonProps) => {
  const growth =
    preTestScore !== null && postTestScore !== null
      ? postTestScore - preTestScore
      : null;

  return (
    <Card className="border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Your Growth</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-4 text-center">
          {/* Pre-Test */}
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Pre-Test</p>
            <p className="text-3xl font-bold text-foreground">
              {preTestScore !== null ? `${Math.round(preTestScore)}%` : "—"}
            </p>
            {preTestScore !== null && (
              <div className="w-full bg-muted rounded-full h-2">
                <div
                  className="bg-akomapa-teal/60 h-2 rounded-full transition-all"
                  style={{ width: `${preTestScore}%` }}
                />
              </div>
            )}
          </div>

          {/* Arrow */}
          <div className="flex items-center justify-center">
            <div className="text-2xl text-muted-foreground">→</div>
          </div>

          {/* Post-Test */}
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Post-Test</p>
            <p className="text-3xl font-bold text-foreground">
              {postTestScore !== null ? `${Math.round(postTestScore)}%` : "—"}
            </p>
            {postTestScore !== null && (
              <div className="w-full bg-muted rounded-full h-2">
                <div
                  className="bg-akomapa-teal h-2 rounded-full transition-all"
                  style={{ width: `${postTestScore}%` }}
                />
              </div>
            )}
          </div>
        </div>

        {/* Growth indicator */}
        {growth !== null && (
          <div
            className={cn(
              "mt-4 p-3 rounded-lg text-center",
              growth > 0
                ? "bg-success/10 text-success"
                : growth < 0
                  ? "bg-red-50 text-red-700"
                  : "bg-muted/50 text-muted-foreground"
            )}
          >
            <div className="flex items-center justify-center gap-2">
              {growth > 0 ? (
                <ArrowUp className="h-5 w-5" />
              ) : growth < 0 ? (
                <ArrowDown className="h-5 w-5" />
              ) : (
                <Minus className="h-5 w-5" />
              )}
              <span className="text-lg font-semibold">
                {growth > 0 ? "+" : ""}
                {Math.round(growth)}%
              </span>
            </div>
            <p className="text-sm mt-1">
              {growth > 0
                ? "Great improvement! Keep up the excellent work."
                : growth < 0
                  ? "Don't worry — review the modules and try again."
                  : "Same score — review the material for improvement."}
            </p>
          </div>
        )}

        {preTestScore === null && postTestScore === null && (
          <p className="text-center text-sm text-muted-foreground mt-4">
            Complete the pre-test and post-test to see your growth.
          </p>
        )}
      </CardContent>
    </Card>
  );
};
