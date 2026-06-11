import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Map } from "lucide-react";

import { getLearningPath } from "@/actions/get-learning-path";
import { EmptyState } from "@/components/empty-state";

import { LearningPathMap } from "./_components/learning-path-map";

const LearningPathPage = async () => {
  const { userId } = await auth();

  if (!userId) {
    return redirect("/sign-in");
  }

  const courses = await getLearningPath(userId);

  const completedCount = courses.filter((c) => c.status === "COMPLETED").length;
  const totalCount = courses.length;

  return (
    <div className="px-4 py-6 sm:p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-foreground">Learning Path</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Your GHELP ethical training roadmap
          {totalCount > 0 && (
            <span className="ml-2 text-akomapa-teal font-medium">
              {completedCount}/{totalCount} courses completed
            </span>
          )}
        </p>
      </div>

      {courses.length === 0 ? (
        <EmptyState
          icon={Map}
          title="No courses available"
          description="Courses will appear here once they are published."
        />
      ) : (
        <LearningPathMap courses={courses} />
      )}
    </div>
  );
};

export default LearningPathPage;
