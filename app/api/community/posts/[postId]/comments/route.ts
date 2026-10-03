import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { requirePrincipal } from "@/lib/auth";
import { assertTrustedOrigin, BODY_BYTES, handleRouteError, parseBody, parseParams, problem } from "@/lib/http";
import { enforceRateLimit } from "@/lib/rate-limit";
import { postParams } from "@/lib/validations/ids";
import { commentCreateSchema } from "@/lib/validations/community";
import { evaluateBadges } from "@/lib/badge-service";
import { appendEvents } from "@/lib/outbox/events";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ postId: string }> }
) {
  try {
    assertTrustedOrigin(req);

    const { userId } = await requirePrincipal();
    await enforceRateLimit(req, "community.comment", { userId: userId });

    const { postId } = parseParams(postParams, await params);
    const body = await parseBody(commentCreateSchema, req, BODY_BYTES.richText);

    const post = await db.forumPost.findUnique({
      where: { id: postId },
      select: { isLocked: true },
    });

    if (!post) {
      return problem("not_found");
    }

    if (post.isLocked) {
      return problem("conflict", {
        message: "This discussion is locked and is not accepting new comments.",
      });
    }

    // At most two levels: a comment, and replies to it.
    if (body.parentId) {
      const parent = await db.forumComment.findUnique({
        where: { id: body.parentId },
        select: { postId: true, parentId: true },
      });

      // A parent on another post is indistinguishable from one that does not
      // exist, so both answer the same way.
      if (!parent || parent.postId !== postId) {
        return problem("validation_failed", {
          fields: [{ path: "parentId", code: "not_in_post" }],
        });
      }

      if (parent.parentId) {
        return problem("validation_failed", {
          fields: [{ path: "parentId", code: "max_depth" }],
        });
      }
    }

    // The comment, the badges it earns, and their events commit together
    // (ADR 0004).
    const { comment, awardedBadges } = await db.$transaction(async (tx) => {
      const comment = await tx.forumComment.create({
        data: {
          content: body.content,
          userId,
          postId,
          parentId: body.parentId ?? null,
        },
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
        },
      });

      const awardedBadges = await evaluateBadges(
        userId,
        { type: "comment_created", commentId: comment.id },
        tx
      );
      await appendEvents(
        tx,
        awardedBadges.map((badge) => ({
          type: "BADGE_AWARDED" as const,
          payload: { userId, badgeId: badge.id },
        }))
      );

      return { comment, awardedBadges };
    });

    return NextResponse.json({
      ...comment,
      awardedBadges: awardedBadges.map((b) => ({
        id: b.id,
        name: b.name,
        description: b.description,
        type: b.type,
      })),
    });
  } catch (error) {
    return handleRouteError("COMMUNITY_COMMENT_POST", error);
  }
}
