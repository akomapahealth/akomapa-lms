import { cache } from "react";

import { db } from "@/lib/db";

export const getFirstTeacherId = cache(async () => {
  const firstUser = await db.user.findFirst({
    orderBy: {
      createdAt: "asc",
    },
  });

  return firstUser?.id ?? null;
});

export const isTeacherServer = async (userId?: string | null) => {
  if (!userId) return false;

  const teacherId = await getFirstTeacherId();

  if (!teacherId) return false;

  return userId === teacherId;
};

