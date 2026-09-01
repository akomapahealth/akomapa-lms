import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { requirePrincipal, toResponse } from "@/lib/auth";
import { logError } from "@/lib/logger";

export async function POST(req: Request) {
  try {
    const { userId } = await requirePrincipal();

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
    const denied = toResponse(error);
    if (denied) return denied;

    logError("JOURNAL_POST", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
