import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { isFaculty } from "@/lib/roles";
import { logError } from "@/lib/logger";

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ courseId: string; quizId: string }> }
) {
  const routeParams = await params;

  try {
    const { userId } = await auth();

    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const faculty = await isFaculty(userId);
    if (!faculty) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { list } = await req.json() as {
      list: { id: string; position: number }[];
    };

    for (const item of list) {
      await db.question.update({
        where: { id: item.id },
        data: { position: item.position },
      });
    }

    return new NextResponse("Success", { status: 200 });
  } catch (error) {
    logError("QUESTIONS_REORDER", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
