import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowUp, ArrowDown, GraduationCap } from "lucide-react";

import { getGradesOverview } from "@/actions/get-grades-overview";
import { EmptyState } from "@/components/empty-state";
import { PageContainer } from "@/components/shell/page-container";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

const GradesPage = async () => {
  const { userId } = await auth();

  if (!userId) {
    return redirect("/sign-in");
  }

  const grades = await getGradesOverview(userId);

  // Calculate overall average
  const coursesWithScores = grades.filter(
    (g) => g.preTestScore !== null || g.postTestScore !== null
  );
  const overallAverage =
    coursesWithScores.length > 0
      ? Math.round(
          coursesWithScores.reduce(
            (sum, g) => sum + (g.postTestScore ?? g.preTestScore ?? 0),
            0
          ) / coursesWithScores.length
        )
      : null;

  return (
    <PageContainer>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
        <h1 className="font-display text-2xl font-semibold text-foreground sm:text-3xl">Grades</h1>
        {overallAverage !== null && (
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Overall Average</p>
            <p className="text-2xl font-bold text-akomapa-teal">
              {overallAverage}%
            </p>
          </div>
        )}
      </div>

      {grades.length === 0 ? (
        <EmptyState
          icon={GraduationCap}
          title="No grades yet"
          description="Enroll in courses and take quizzes to see your grades."
          actionLabel="Browse Courses"
          actionHref="/search"
        />
      ) : (
        <>
        {/* Mobile: stacked cards */}
        <div className="flex flex-col gap-3 sm:hidden">
          {grades.map((grade) => (
            <Link
              key={grade.courseId}
              href={`/grades/${grade.courseId}`}
              className="rounded-xl border border-border/70 bg-card p-4 shadow-soft transition hover:border-akomapa-teal/40"
            >
              <p className="font-medium text-foreground">{grade.courseTitle}</p>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Pre-Test</p>
                  <p className="mt-0.5 font-medium">
                    {grade.preTestScore !== null
                      ? `${Math.round(grade.preTestScore)}%`
                      : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Post-Test</p>
                  <p className="mt-0.5 font-medium">
                    {grade.postTestScore !== null
                      ? `${Math.round(grade.postTestScore)}%`
                      : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Growth</p>
                  <p
                    className={cn(
                      "mt-0.5 font-medium",
                      grade.growth !== null && grade.growth > 0
                        ? "text-success"
                        : grade.growth !== null && grade.growth < 0
                          ? "text-destructive"
                          : "text-muted-foreground"
                    )}
                  >
                    {grade.growth !== null
                      ? `${grade.growth > 0 ? "+" : ""}${grade.growth}%`
                      : "—"}
                  </p>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <Progress value={grade.progressPercent} className="h-2 flex-1" />
                <span className="text-xs text-muted-foreground">
                  {grade.progressPercent}%
                </span>
              </div>
            </Link>
          ))}
        </div>
        {/* Desktop: table */}
        <div className="hidden overflow-x-auto rounded-xl border sm:block">
          <Table className="min-w-[600px]">
            <TableHeader>
              <TableRow>
                <TableHead>Course</TableHead>
                <TableHead className="text-center">Pre-Test</TableHead>
                <TableHead className="text-center">Post-Test</TableHead>
                <TableHead className="text-center">Growth</TableHead>
                <TableHead>Progress</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {grades.map((grade) => (
                <TableRow key={grade.courseId} className="cursor-pointer">
                  <TableCell className="font-medium">
                    <Link
                      href={`/grades/${grade.courseId}`}
                      className="hover:text-akomapa-teal transition"
                    >
                      {grade.courseTitle}
                    </Link>
                  </TableCell>
                  <TableCell className="text-center">
                    {grade.preTestScore !== null
                      ? `${Math.round(grade.preTestScore)}%`
                      : "—"}
                  </TableCell>
                  <TableCell className="text-center">
                    {grade.postTestScore !== null
                      ? `${Math.round(grade.postTestScore)}%`
                      : "—"}
                  </TableCell>
                  <TableCell className="text-center">
                    {grade.growth !== null ? (
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 font-medium",
                          grade.growth > 0
                            ? "text-success"
                            : grade.growth < 0
                              ? "text-destructive"
                              : "text-muted-foreground"
                        )}
                      >
                        {grade.growth > 0 ? (
                          <ArrowUp className="h-3 w-3" />
                        ) : grade.growth < 0 ? (
                          <ArrowDown className="h-3 w-3" />
                        ) : null}
                        {grade.growth > 0 ? "+" : ""}
                        {grade.growth}%
                      </span>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Progress
                        value={grade.progressPercent}
                        className="h-2 w-20"
                      />
                      <span className="text-xs text-muted-foreground">
                        {grade.progressPercent}%
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        </>
      )}
    </PageContainer>
  );
};

export default GradesPage;
