import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowUp, ArrowDown, GraduationCap } from "lucide-react";

import { getGradesOverview } from "@/actions/get-grades-overview";
import { Badge } from "@/components/ui/badge";
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
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Grades</h1>
        {overallAverage !== null && (
          <div className="text-right">
            <p className="text-sm text-slate-500">Overall Average</p>
            <p className="text-2xl font-bold text-akomapa-teal">
              {overallAverage}%
            </p>
          </div>
        )}
      </div>

      {grades.length === 0 ? (
        <div className="flex items-center justify-center h-[400px] border border-dashed border-slate-300 rounded-lg">
          <div className="text-center">
            <GraduationCap className="h-10 w-10 text-slate-400 mx-auto mb-2" />
            <p className="text-slate-500 text-lg">No grades yet</p>
            <p className="text-slate-400 text-sm mt-1">
              Enroll in courses and take quizzes to see your grades
            </p>
          </div>
        </div>
      ) : (
        <div className="border rounded-md">
          <Table>
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
                            ? "text-emerald-600"
                            : grade.growth < 0
                              ? "text-red-600"
                              : "text-slate-500"
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
                      <span className="text-xs text-slate-500">
                        {grade.progressPercent}%
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};

export default GradesPage;
