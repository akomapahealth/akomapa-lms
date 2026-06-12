import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { FileQuestion, Plus } from "lucide-react";

import { db } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const AdminQuizzesPage = async () => {
  const { userId } = await auth();

  if (!userId) {
    return redirect("/sign-in");
  }

  const quizzes = await db.quiz.findMany({
    include: {
      course: { select: { id: true, title: true } },
      module: { select: { title: true } },
      _count: { select: { questions: true, attempts: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const typeLabels: Record<string, string> = {
    PRE_TEST: "Pre-Test",
    POST_TEST: "Post-Test",
    MODULE_QUIZ: "Module Quiz",
  };

  return (
    <div className="px-4 py-6 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-foreground">All Quizzes</h1>
      </div>

      {quizzes.length === 0 ? (
        <div className="flex items-center justify-center h-[400px] border border-dashed border-border rounded-lg">
          <div className="text-center">
            <FileQuestion className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
            <p className="text-muted-foreground text-lg">No quizzes yet</p>
            <p className="text-muted-foreground text-sm mt-1">
              Create quizzes from within a course
            </p>
          </div>
        </div>
      ) : (
        <div className="border rounded-md overflow-x-auto">
          <Table className="min-w-[600px]">
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Course</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-center">Questions</TableHead>
                <TableHead className="text-center">Attempts</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {quizzes.map((quiz) => (
                <TableRow key={quiz.id}>
                  <TableCell className="font-medium">
                    <Link
                      href={`/admin/courses/${quiz.courseId}/quizzes/${quiz.id}`}
                      className="hover:text-akomapa-teal transition"
                    >
                      {quiz.title}
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {quiz.course?.title ?? "—"}
                    {quiz.module && (
                      <span className="text-xs text-muted-foreground block">
                        {quiz.module.title}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {typeLabels[quiz.type] ?? quiz.type}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    {quiz._count.questions}
                  </TableCell>
                  <TableCell className="text-center">
                    {quiz._count.attempts}
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={
                        quiz.isPublished ? "bg-akomapa-teal" : "bg-muted-foreground/60"
                      }
                    >
                      {quiz.isPublished ? "Published" : "Draft"}
                    </Badge>
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

export default AdminQuizzesPage;
