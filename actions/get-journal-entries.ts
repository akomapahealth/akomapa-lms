import { db } from "@/lib/db";

interface GetJournalEntriesParams {
  userId: string;
  courseId?: string;
  moduleId?: string;
  search?: string;
}

export async function getJournalEntries({
  userId,
  courseId,
  moduleId,
  search,
}: GetJournalEntriesParams) {
  const entries = await db.journalEntry.findMany({
    where: {
      userId,
      ...(courseId && { courseId }),
      ...(moduleId && { moduleId }),
      ...(search && {
        OR: [
          { title: { contains: search, mode: "insensitive" as const } },
          { content: { contains: search, mode: "insensitive" as const } },
        ],
      }),
    },
    include: {
      course: { select: { id: true, title: true } },
      module: { select: { id: true, title: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  return entries;
}
