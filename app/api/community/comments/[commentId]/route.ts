import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { authorizeComment, requirePrincipal } from "@/lib/auth";
import { assertTrustedOrigin, BODY_BYTES, handleRouteError, parseBody, parseParams } from "@/lib/http";
import { commentParams } from "@/lib/validations/ids";
import { commentUpdateSchema } from "@/lib/validations/community";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ commentId: string }> }
) {
  try {
    assertTrustedOrigin(req);

    const { commentId } = parseParams(commentParams, await params);

    // Author only, deliberately: a moderator may remove a comment but not
    // rewrite it, because editing leaves someone's name on words they did not
    // write. See docs/permission-matrix.md; #89 revisits this with audit trails.
    const principal = await requirePrincipal();
    await authorizeComment(principal, "comment:update", commentId);

    const { content } = await parseBody(commentUpdateSchema, req, BODY_BYTES.richText);

    const updated = await db.forumComment.update({
      where: { id: commentId },
      data: { content },
    });

    return NextResponse.json(updated);
  } catch (error) {
    return handleRouteError("COMMUNITY_COMMENT_PATCH", error);
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ commentId: string }> }
) {
  try {
    assertTrustedOrigin(req);

    const { commentId } = parseParams(commentParams, await params);

    const principal = await requirePrincipal();
    await authorizeComment(principal, "comment:delete", commentId);

    await db.forumComment.delete({ where: { id: commentId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleRouteError("COMMUNITY_COMMENT_DELETE", error);
  }
}
