import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { authorizeComment, requirePrincipal, toResponse } from "@/lib/auth";
import { logError } from "@/lib/logger";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ commentId: string }> }
) {
  try {
    const { commentId } = await params;

    // Author only, deliberately: a moderator may remove a comment but not
    // rewrite it, because editing leaves someone's name on words they did not
    // write. See docs/permission-matrix.md; #89 revisits this with audit trails.
    const principal = await requirePrincipal();
    await authorizeComment(principal, "comment:update", commentId);

    const { content } = await req.json();

    if (!content) {
      return new NextResponse("Content is required", { status: 400 });
    }

    const updated = await db.forumComment.update({
      where: { id: commentId },
      data: { content },
    });

    return NextResponse.json(updated);
  } catch (error) {
    const denied = toResponse(error);
    if (denied) return denied;

    logError("COMMUNITY_COMMENT_PATCH", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ commentId: string }> }
) {
  try {
    const { commentId } = await params;

    const principal = await requirePrincipal();
    await authorizeComment(principal, "comment:delete", commentId);

    await db.forumComment.delete({ where: { id: commentId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    const denied = toResponse(error);
    if (denied) return denied;

    logError("COMMUNITY_COMMENT_DELETE", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
