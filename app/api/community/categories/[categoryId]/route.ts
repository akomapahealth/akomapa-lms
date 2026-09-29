import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { requireCapability, requirePrincipal } from "@/lib/auth";
import { handleRouteError, parseBody, parseParams, problem } from "@/lib/http";
import { categoryParams } from "@/lib/validations/ids";
import { categoryUpdateSchema } from "@/lib/validations/community";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ categoryId: string }> }
) {
  try {
    const principal = await requirePrincipal();
    requireCapability(principal, "community:moderate");

    const { categoryId } = parseParams(categoryParams, await params);
    const body = await parseBody(categoryUpdateSchema, req);

    const updated = await db.forumCategory.update({
      where: { id: categoryId },
      data: body,
    });

    return NextResponse.json(updated);
  } catch (error) {
    return handleRouteError("COMMUNITY_CATEGORY_PATCH", error);
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ categoryId: string }> }
) {
  try {
    const principal = await requirePrincipal();
    requireCapability(principal, "community:moderate");

    const { categoryId } = parseParams(categoryParams, await params);

    const postCount = await db.forumPost.count({ where: { categoryId } });

    if (postCount > 0) {
      // A conflict with current state, not malformed input: the same request
      // succeeds once the posts are moved or removed.
      return problem("conflict", {
        message: "This category still has posts. Move or delete them first.",
      });
    }

    await db.forumCategory.delete({ where: { id: categoryId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleRouteError("COMMUNITY_CATEGORY_DELETE", error);
  }
}
