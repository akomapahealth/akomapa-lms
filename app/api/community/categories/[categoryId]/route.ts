import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { requireCapability, requirePrincipal, toResponse } from "@/lib/auth";
import { logError } from "@/lib/logger";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ categoryId: string }> }
) {
  try {
    const principal = await requirePrincipal();
    requireCapability(principal, "community:moderate");

    const { categoryId } = await params;
    const { name, description, color } = await req.json();

    const updated = await db.forumCategory.update({
      where: { id: categoryId },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(color !== undefined && { color }),
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    const denied = toResponse(error);
    if (denied) return denied;

    logError("COMMUNITY_CATEGORY_PATCH", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ categoryId: string }> }
) {
  try {
    const principal = await requirePrincipal();
    requireCapability(principal, "community:moderate");

    const { categoryId } = await params;

    // Check if category has posts
    const postCount = await db.forumPost.count({
      where: { categoryId },
    });

    if (postCount > 0) {
      return new NextResponse(
        "Cannot delete category with existing posts",
        { status: 400 }
      );
    }

    await db.forumCategory.delete({ where: { id: categoryId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    const denied = toResponse(error);
    if (denied) return denied;

    logError("COMMUNITY_CATEGORY_DELETE", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
