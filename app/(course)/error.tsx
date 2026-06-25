"use client";

import { AlertTriangle } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function CourseError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex items-center justify-center h-[60vh]">
      <div className="text-center space-y-4">
        <div className="flex justify-center">
          <AlertTriangle className="h-10 w-10 text-warning" />
        </div>
        <h2 className="text-lg font-semibold text-foreground">
          Error Loading Course
        </h2>
        <p className="text-sm text-muted-foreground max-w-sm">
          We couldn&apos;t load this course content. Please try again.
        </p>
        <div className="flex gap-3 justify-center">
          <Button variant="outline" size="sm" onClick={reset}>
            Try Again
          </Button>
          <Button size="sm" asChild>
            <Link href="/courses">Back to Courses</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
