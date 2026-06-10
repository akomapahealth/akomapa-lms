import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { type QuizProgressItem } from "@/actions/get-quiz-progress";
import { FileQuestion } from "lucide-react";

interface QuizProgressSectionProps {
  quizzes: QuizProgressItem[];
}

const quizStatusMap = {
  NOT_ATTEMPTED: "NOT_STARTED",
  PASSED: "COMPLETED",
  FAILED: "IN_PROGRESS",
} as const;

export const QuizProgressSection = ({
  quizzes,
}: QuizProgressSectionProps) => {
  return (
    <Card className="p-4">
      <h3 className="font-semibold text-sm text-slate-700 mb-3">
        Quiz Progress ({quizzes.length})
      </h3>
      {quizzes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-slate-400">
          <FileQuestion className="h-8 w-8 mb-2" />
          <p className="text-sm">No quizzes available</p>
        </div>
      ) : (
        <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
          {quizzes.map((quiz, index) => (
            <div
              key={quiz.quizId}
              className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-700 truncate">
                  {index + 1}. {quiz.title}
                </p>
                {quiz.moduleName && (
                  <p className="text-xs text-slate-400 truncate">
                    {quiz.moduleName}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-2">
                {quiz.bestScore !== null && (
                  <span className="text-sm font-medium text-slate-600">
                    {Math.round(quiz.bestScore)}%
                  </span>
                )}
                <StatusBadge status={quizStatusMap[quiz.status]} />
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};
