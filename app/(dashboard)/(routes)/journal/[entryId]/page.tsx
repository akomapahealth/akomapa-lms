import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { notFound } from "next/navigation";

import { db } from "@/lib/db";
import { JournalEditor } from "../new/_components/journal-editor";

export default async function EditJournalEntryPage({
  params,
}: {
  params: Promise<{ entryId: string }>;
}) {
  const { userId } = await auth();
  if (!userId) return redirect("/sign-in");

  const { entryId } = await params;

  const entry = await db.journalEntry.findUnique({
    where: { id: entryId },
    select: {
      id: true,
      title: true,
      content: true,
      isPrivate: true,
      courseId: true,
      moduleId: true,
      userId: true,
    },
  });

  if (!entry || entry.userId !== userId) {
    return notFound();
  }

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
    <div className="px-4 py-6 sm:p-6 max-w-4xl mx-auto">
      <JournalEditor
        courses={courses}
        existingEntry={entry}
      />
    </div>
  );
}
