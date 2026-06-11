import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Circle, Clock } from "lucide-react";

import { getGradesDetail } from "@/actions/get-grades-detail";
import { getCertificate } from "@/actions/get-certificate";
import { Breadcrumb } from "@/components/breadcrumb";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { CertificateSection } from "./_components/certificate-section";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScoreComparison } from "@/components/score-comparison";
import { cn } from "@/lib/utils";

const GradesDetailPage = async ({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) => {
  const { courseId } = await params;
  const { userId } = await auth();

  if (!userId) {
    return redirect("/sign-in");
  }

  const [detail, certificate] = await Promise.all([
    getGradesDetail(userId, courseId),
    getCertificate(userId, courseId),
  ]);

  if (!detail) {
    return redirect("/grades");
  }

  const isCourseCompleted = detail.modules.every(
    (mod) => mod.status === "COMPLETED"
  );

  const typeLabels: Record<string, string> = {
    PRE_TEST: "Pre-Test",
    POST_TEST: "Post-Test",
    MODULE_QUIZ: "Module Quiz",
  };

  return (
    <div className="px-4 py-6 sm:p-6">
      <Breadcrumb
        items={[
          { label: "Grades", href: "/grades" },
          { label: detail.courseTitle },
        ]}
      />

      <h1 className="text-xl sm:text-2xl font-bold text-foreground mt-4 mb-6">
        {detail.courseTitle}
      </h1>

      <div className="space-y-6">
        {/* Certificate */}
        <CertificateSection
          courseId={courseId}
          isCompleted={isCourseCompleted}
          existingCertificate={certificate ? {
            certificateNumber: certificate.certificateNumber,
            pdfUrl: certificate.pdfUrl,
            issuedAt: certificate.issuedAt,
          } : null}
        />

        {/* Score Comparison */}
        <ScoreComparison
          preTestScore={detail.preTestScore}
          postTestScore={detail.postTestScore}
        />

        {/* Module Progress */}
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-lg">Module Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
            <Table className="min-w-[600px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Module</TableHead>
                  <TableHead className="text-center">Topics</TableHead>
                  <TableHead className="text-center">Quiz Score</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detail.modules.map((mod) => (
                  <TableRow key={mod.moduleId}>
                    <TableCell className="font-medium">
                      {mod.moduleTitle}
                    </TableCell>
                    <TableCell className="text-center">
                      {mod.completedTopics}/{mod.totalTopics}
                    </TableCell>
                    <TableCell className="text-center">
                      {mod.quizScore !== null ? `${mod.quizScore}%` : "—"}
                    </TableCell>
                    <TableCell>
                      {mod.status === "COMPLETED" ? (
                        <div className="flex items-center gap-1 text-emerald-600">
                          <CheckCircle2 className="h-4 w-4" />
                          <span className="text-sm">Done</span>
                        </div>
                      ) : mod.status === "IN_PROGRESS" ? (
                        <div className="flex items-center gap-1 text-akomapa-teal">
                          <Clock className="h-4 w-4" />
                          <span className="text-sm">
                            {Math.round(
                              (mod.completedTopics / mod.totalTopics) * 100
                            )}
                            %
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Circle className="h-4 w-4" />
                          <span className="text-sm">Not started</span>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          </CardContent>
        </Card>

        {/* Quiz Attempt History */}
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-lg">Quiz Attempt History</CardTitle>
          </CardHeader>
          <CardContent>
            {detail.attempts.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No quiz attempts yet
              </p>
            ) : (
              <div className="overflow-x-auto">
              <Table className="min-w-[600px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Quiz</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-center">Score</TableHead>
                    <TableHead className="text-center">Time</TableHead>
                    <TableHead>Result</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detail.attempts.map((attempt) => (
                    <TableRow key={attempt.attemptId}>
                      <TableCell className="font-medium">
                        <div>
                          <span>{attempt.quizTitle}</span>
                          <Badge
                            variant="outline"
                            className="ml-2 text-xs"
                          >
                            {typeLabels[attempt.quizType] ?? attempt.quizType}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(attempt.date).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-center">
                        {attempt.percentage}%
                      </TableCell>
                      <TableCell className="text-center text-sm text-muted-foreground">
                        {attempt.timeTaken}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={cn(
                            attempt.passed
                              ? "bg-emerald-500"
                              : "bg-red-500"
                          )}
                        >
                          {attempt.passed ? "✓ Passed" : "✗ Failed"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default GradesDetailPage;
