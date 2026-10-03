import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { requirePrincipal } from "@/lib/auth";
import { assertTrustedOrigin, BODY_BYTES, handleRouteError, parseBody } from "@/lib/http";
import { enforceRateLimit } from "@/lib/rate-limit";
import { postCreateSchema } from "@/lib/validations/community";
import { evaluateBadges } from "@/lib/badge-service";
import { appendEvents } from "@/lib/outbox/events";

export async function POST(req: Request) {
  try {
    assertTrustedOrigin(req);

    const { userId } = await requirePrincipal();
    await enforceRateLimit(req, "community.post", { userId: userId });

    // Rich text, so the larger body ceiling. The previous check was
    // `if (!title || !content || !categoryId)`, which accepted a title of any
    // length, content of any size, and a `categoryId` that was any non-empty
    // string -- including one naming a category that does not exist, which then
    // failed as a 500 on the foreign key.
    const body = await parseBody(postCreateSchema, req, BODY_BYTES.richText);

    // The post, the badges it earns, and their events commit together
    // (ADR 0004): a badge for a post that failed to save cannot exist.
    const { post, awardedBadges } = await db.$transaction(async (tx) => {
      const post = await tx.forumPost.create({
        data: {
          title: body.title,
          content: body.content,
          categoryId: body.categoryId,
          courseId: body.courseId ?? null,
          userId,
        },
      });

      const awardedBadges = await evaluateBadges(userId, { type: "post_created", postId: post.id }, tx);
      await appendEvents(
        tx,
        awardedBadges.map((badge) => ({
          type: "BADGE_AWARDED" as const,
          payload: { userId, badgeId: badge.id },
        }))
      );

      return { post, awardedBadges };
    });

    return NextResponse.json({
      ...post,
      awardedBadges: awardedBadges.map((b) => ({
        id: b.id,
        name: b.name,
        description: b.description,
        type: b.type,
      })),
    });
  } catch (error) {
    return handleRouteError("COMMUNITY_POSTS_POST", error);
  }
}
