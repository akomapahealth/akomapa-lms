import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";

import { getJournalEntries } from "@/actions/get-journal-entries";
import { db } from "@/lib/db";
import { JournalList } from "./_components/journal-list";
import { JournalFilters } from "./_components/journal-filters";
import { PageContainer } from "@/components/shell/page-container";

export default async function JournalPage({
  searchParams,
}: {
  searchParams: Promise<{
    courseId?: string;
    moduleId?: string;
    search?: string;
  }>;
}) {
  const { userId } = await auth();
  if (!userId) return redirect("/sign-in");

  const params = await searchParams;

  const entries = await getJournalEntries({
    userId,
    courseId: params.courseId,
    moduleId: params.moduleId,
    search: params.search,
  });

  // Get user's enrolled courses for filter dropdown
  const courses = await db.course.findMany({
    where: { purchases: { some: { userId } } },
    select: { id: true, title: true },
    orderBy: { title: "asc" },
  });

  return (
    <PageContainer className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl sm:text-2xl font-bold text-foreground">My Reflections</h1>
        <Link
          href="/journal/new"
          className="inline-flex items-center px-4 py-2 bg-akomapa-teal text-white text-sm font-medium rounded-md hover:bg-akomapa-teal-dark transition"
        >
          + New Entry
        </Link>
      </div>

      <JournalFilters courses={courses} />

      <JournalList entries={entries} />
    </PageContainer>
  );
}
