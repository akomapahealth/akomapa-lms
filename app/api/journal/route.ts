import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { requirePrincipal } from "@/lib/auth";
import { BODY_BYTES, handleRouteError, parseBody } from "@/lib/http";
import { journalCreateSchema } from "@/lib/validations/journal";

export async function POST(req: Request) {
  try {
    const { userId } = await requirePrincipal();

    const body = await parseBody(journalCreateSchema, req, BODY_BYTES.richText);

    const entry = await db.journalEntry.create({
      data: {
        title: body.title,
        content: body.content,
        // Private unless the learner says otherwise, and only a real boolean
        // can say otherwise: `isPrivate ?? true` treated the string "false" as
        // a value and stored a public entry.
        isPrivate: body.isPrivate ?? true,
        prompt: body.prompt ?? null,
        moduleId: body.moduleId ?? null,
        courseId: body.courseId ?? null,
        userId,
      },
    });

    return NextResponse.json(entry);
  } catch (error) {
    return handleRouteError("JOURNAL_POST", error);
  }
}
