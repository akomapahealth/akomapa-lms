import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { title, content, isPrivate, prompt, moduleId, courseId } =
      await req.json();

    if (!title || !content) {
      return new NextResponse("Title and content are required", {
        status: 400,
      });
    }

    const entry = await db.journalEntry.create({
      data: {
        title,
        content,
        isPrivate: isPrivate ?? true,
        prompt: prompt || null,
        moduleId: moduleId || null,
        courseId: courseId || null,
        userId,
      },
    });

    return NextResponse.json(entry);
  } catch (error) {
    console.log("[JOURNAL_POST]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
