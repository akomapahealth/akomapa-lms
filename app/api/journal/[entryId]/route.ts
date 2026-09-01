import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { requirePrincipal, toResponse } from "@/lib/auth";
import { logError } from "@/lib/logger";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ entryId: string }> }
) {
  try {
    const { userId } = await requirePrincipal();

    const { entryId } = await params;
    const values = await req.json();

    const entry = await db.journalEntry.findUnique({
      where: { id: entryId },
      select: { userId: true },
    });

    if (!entry || entry.userId !== userId) {
      return new NextResponse("Not found", { status: 404 });
    }

    const updated = await db.journalEntry.update({
      where: { id: entryId },
      data: {
        ...(values.title !== undefined && { title: values.title }),
        ...(values.content !== undefined && { content: values.content }),
        ...(values.isPrivate !== undefined && { isPrivate: values.isPrivate }),
        ...(values.moduleId !== undefined && {
          moduleId: values.moduleId || null,
        }),
        ...(values.courseId !== undefined && {
          courseId: values.courseId || null,
        }),
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    const denied = toResponse(error);
    if (denied) return denied;

    logError("JOURNAL_PATCH", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ entryId: string }> }
) {
  try {
    const { userId } = await requirePrincipal();

    const { entryId } = await params;

    const entry = await db.journalEntry.findUnique({
      where: { id: entryId },
      select: { userId: true },
    });

    if (!entry || entry.userId !== userId) {
      return new NextResponse("Not found", { status: 404 });
    }

    await db.journalEntry.delete({ where: { id: entryId } });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    const denied = toResponse(error);
    if (denied) return denied;

    logError("JOURNAL_DELETE", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
