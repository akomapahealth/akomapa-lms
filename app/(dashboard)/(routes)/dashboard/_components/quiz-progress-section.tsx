import Link from "next/link";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { type QuizProgressItem } from "@/actions/get-quiz-progress";
import { FileQuestion } from "lucide-react";

interface QuizProgressSectionProps {
  quizzes: QuizProgressItem[];
  courseId?: string;
}

const quizStatusMap = {
  NOT_ATTEMPTED: "NOT_STARTED",
  PASSED: "COMPLETED",
  FAILED: "IN_PROGRESS",
} as const;

export const QuizProgressSection = ({
  quizzes,
  courseId,
}: QuizProgressSectionProps) => {
  return (
    <Card className="p-4">
      <h3 className="font-semibold text-sm text-foreground mb-3">
        Quiz Progress ({quizzes.length})
      </h3>
      {quizzes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-muted-foreground/70">
          <FileQuestion className="h-8 w-8 mb-2" />
          <p className="text-sm">No quizzes available</p>
        </div>
      ) : (
        <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
          {quizzes.map((quiz, index) => {
            const content = (
              <div
                className="flex items-center justify-between py-2 border-b border-border/50 last:border-0 hover:bg-muted/50/50 transition rounded -mx-1 px-1"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate">
                    {index + 1}. {quiz.title}
                  </p>
                  {quiz.moduleName && (
                    <p className="text-xs text-muted-foreground/70 truncate">
                      {quiz.moduleName}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  {quiz.bestScore !== null && (
                    <span className="text-sm font-medium text-muted-foreground">
                      {Math.round(quiz.bestScore)}%
                    </span>
                  )}
                  <StatusBadge status={quizStatusMap[quiz.status]} />
                </div>
              </div>
            );

            return courseId ? (
              <Link
                key={quiz.quizId}
                href={`/courses/${courseId}/quiz/${quiz.quizId}`}
              >
                {content}
              </Link>
            ) : (
              <div key={quiz.quizId}>{content}</div>
            );
          })}
        </div>
      )}
      <Link
        href="/grades"
        className="block text-center text-xs text-akomapa-teal hover:underline mt-3 pt-2 border-t border-border/50"
      >
        View All Grades →
      </Link>
    </Card>
  );
};
