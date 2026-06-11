import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { db } from "@/lib/db";
import { JournalEditor } from "./_components/journal-editor";

export default async function NewJournalEntryPage({
  searchParams,
}: {
  searchParams: Promise<{
    moduleId?: string;
    courseId?: string;
    prompt?: string;
  }>;
}) {
  const { userId } = await auth();
  if (!userId) return redirect("/sign-in");

  const params = await searchParams;

  // Get user's enrolled courses for the course selector
  const courses = await db.course.findMany({
    where: { purchases: { some: { userId } } },
    select: {
      id: true,
      title: true,
      modules: {
        where: { isPublished: true },
        select: { id: true, title: true },
        orderBy: { position: "asc" },
      },
    },
    orderBy: { title: "asc" },
  });

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <JournalEditor
        courses={courses}
        initialCourseId={params.courseId}
        initialModuleId={params.moduleId}
        guidedPrompt={params.prompt}
      />
    </div>
  );
}
