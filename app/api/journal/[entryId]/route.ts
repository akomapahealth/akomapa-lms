import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { requirePrincipal } from "@/lib/auth";
import { assertTrustedOrigin, BODY_BYTES, handleRouteError, parseBody, parseParams, problem } from "@/lib/http";
import { journalEntryParams } from "@/lib/validations/ids";
import { journalUpdateSchema } from "@/lib/validations/journal";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ entryId: string }> }
) {
  try {
    assertTrustedOrigin(req);

    const { userId } = await requirePrincipal();

    const { entryId } = parseParams(journalEntryParams, await params);
    // Strict: `values` was the raw body, and every field was copied across if
    // merely `!== undefined`, so `isPrivate: "no"` made a private entry public.
    const body = await parseBody(journalUpdateSchema, req, BODY_BYTES.richText);

    const entry = await db.journalEntry.findUnique({
      where: { id: entryId },
      select: { userId: true },
    });

    // Someone else's entry and a nonexistent one answer identically; a Journal
    // is private content and the endpoint must not confirm that an id exists.
    if (!entry || entry.userId !== userId) {
      return problem("not_found");
    }

    const updated = await db.journalEntry.update({
      where: { id: entryId },
      data: {
        ...(body.title !== undefined && { title: body.title }),
        ...(body.content !== undefined && { content: body.content }),
        ...(body.isPrivate !== undefined && { isPrivate: body.isPrivate }),
        ...(body.moduleId !== undefined && { moduleId: body.moduleId ?? null }),
        ...(body.courseId !== undefined && { courseId: body.courseId ?? null }),
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    return handleRouteError("JOURNAL_PATCH", error);
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ entryId: string }> }
) {
  try {
    assertTrustedOrigin(req);

    const { userId } = await requirePrincipal();

    const { entryId } = parseParams(journalEntryParams, await params);

    const entry = await db.journalEntry.findUnique({
      where: { id: entryId },
      select: { userId: true },
    });

    if (!entry || entry.userId !== userId) {
      return problem("not_found");
    }

    await db.journalEntry.delete({ where: { id: entryId } });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return handleRouteError("JOURNAL_DELETE", error);
  }
}
