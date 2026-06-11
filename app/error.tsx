"use client";

import { AlertTriangle } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="text-center space-y-4">
        <div className="flex justify-center">
          <AlertTriangle className="h-12 w-12 text-amber-500" />
        </div>
        <h2 className="text-xl font-semibold text-slate-800">
          Something went wrong
        </h2>
        <p className="text-sm text-slate-500 max-w-md">
          An unexpected error occurred. Please try again or return to the
          dashboard.
        </p>
        <div className="flex gap-3 justify-center">
          <Button variant="outline" onClick={reset}>
            Try Again
          </Button>
          <Button asChild>
            <Link href="/">Go to Dashboard</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
