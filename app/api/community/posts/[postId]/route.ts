import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { authorizePost, requirePrincipal } from "@/lib/auth";
import { BODY_BYTES, handleRouteError, parseBody, parseParams, problem } from "@/lib/http";
import { postParams } from "@/lib/validations/ids";
import { postUpdateSchema } from "@/lib/validations/community";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ postId: string }> }
) {
  try {
    const { userId } = await requirePrincipal();

    const { postId } = parseParams(postParams, await params);

    const post = await db.forumPost.findUnique({
      where: { id: postId },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            imageUrl: true,
            role: true,
          },
        },
        category: {
          select: { id: true, name: true, color: true },
        },
        course: {
          select: { id: true, title: true },
        },
        comments: {
          where: { parentId: null },
          orderBy: { createdAt: "asc" },
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                imageUrl: true,
                role: true,
              },
            },
            likes: { where: { userId }, select: { id: true } },
            _count: { select: { likes: true } },
            replies: {
              orderBy: { createdAt: "asc" },
              include: {
                user: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    imageUrl: true,
                    role: true,
                  },
                },
                likes: { where: { userId }, select: { id: true } },
                _count: { select: { likes: true } },
              },
            },
          },
        },
        likes: { where: { userId }, select: { id: true } },
        _count: { select: { likes: true, comments: true } },
      },
    });

    if (!post) {
      return problem("not_found");
    }

    return NextResponse.json(post);
  } catch (error) {
    return handleRouteError("COMMUNITY_POST_GET", error);
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ postId: string }> }
) {
  try {
    const { postId } = parseParams(postParams, await params);

    // Author or moderator. The rule lives in lib/auth/policy.ts rather than
    // being re-derived at each of the call sites that used to inline it.
    const principal = await requirePrincipal();
    await authorizePost(principal, "post:update", postId);

    // Strict: the body used to be spread field by field with no bounds, and a
    // `categoryId` naming a category that does not exist failed as a 500.
    const body = await parseBody(postUpdateSchema, req, BODY_BYTES.richText);

    const updated = await db.forumPost.update({
      where: { id: postId },
      data: body,
    });

    return NextResponse.json(updated);
  } catch (error) {
    return handleRouteError("COMMUNITY_POST_PATCH", error);
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ postId: string }> }
) {
  try {
    const { postId } = parseParams(postParams, await params);

    const principal = await requirePrincipal();
    await authorizePost(principal, "post:delete", postId);

    await db.forumPost.delete({ where: { id: postId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleRouteError("COMMUNITY_POST_DELETE", error);
  }
}
