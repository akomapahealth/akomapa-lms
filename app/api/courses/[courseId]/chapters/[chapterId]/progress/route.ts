import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { requirePrincipal } from "@/lib/auth";
import { markCourseCompleted, topicEntitlement } from "@/lib/entitlement";
import { assertTrustedOrigin, handleRouteError, parseBody, parseParams, problem } from "@/lib/http";
import { enforceRateLimit } from "@/lib/rate-limit";
import { topicParams } from "@/lib/validations/ids";
import { progressSchema } from "@/lib/validations/topic";
import { findPublishedTopicInCourse } from "@/lib/courses/topic-access";
import {
    isCourseComplete as courseIsComplete,
    isModuleComplete as moduleIsComplete,
} from "@/lib/courses/completion";
import { evaluateBadges, type BadgeEvent } from "@/lib/badge-service";
import { updateStreak } from "@/lib/streak-service";
import { generateCertificate } from "@/lib/certificate-service";
import { logError } from "@/lib/logger";

export async function PUT(
    req: Request,
    { params }: { params: Promise<{ courseId: string; chapterId: string }> }
) {
    try {
        assertTrustedOrigin(req);

        const routeParams = parseParams(topicParams, await params);

        const principal = await requirePrincipal();
        await enforceRateLimit(req, "write.default", { userId: principal.userId });
        const { userId } = principal;

        // Before the Topic lookup: an unparseable or out-of-bounds body should
        // not cost a query, and the shape is what decides whether the completion
        // cascade below runs at all.
        const { isCompleted } = await parseBody(progressSchema, req);

        // Published, and in this Course. Without the binding a progress write
        // could be aimed at any Topic in the product by id, and the cascade
        // below -- badges, streaks, Enrollment status, certificate issuance --
        // would run for a Course the learner is not on.
        const topic = await findPublishedTopicInCourse(
            routeParams.courseId,
            routeParams.chapterId
        );

        if (!topic) {
            return problem("not_found");
        }

        // Entitlement through the one module (ADR 0002). It covers the free-preview
        // Topic case as well, so the two conditions are no longer separate here.
        // Reading `Purchase` let a suspended learner keep completing Topics --
        // and therefore keep earning badges, streaks, and a Certificate.
        const entitlement = await topicEntitlement(
            principal,
            routeParams.courseId,
            routeParams.chapterId
        );

        if (!entitlement.canReadTopic) {
            return problem("not_found");
        }

        const userProgress = await db.userProgress.upsert({
            where: {
                userId_topicId: {
                    userId,
                    topicId: routeParams.chapterId,
                }
            },
            update: {
                isCompleted
            },
            create: {
                userId,
                topicId: routeParams.chapterId,
                isCompleted,
            }
        });

        // Check if this completion finishes the entire module
        let isModuleComplete = false;
        let moduleName = "";

        if (isCompleted) {
            const owningModule = await db.module.findUnique({
                where: { id: topic.moduleId },
                select: {
                    title: true,
                    topics: {
                        where: { isPublished: true },
                        select: {
                            id: true,
                            userProgress: {
                                where: { userId },
                                select: { isCompleted: true },
                            },
                        },
                    },
                },
            });

            if (owningModule) {
                moduleName = owningModule.title;
                // A Module with no published Topics is not complete. `[].every()`
                // is true, so the previous check treated emptiness as success.
                isModuleComplete = moduleIsComplete(
                    {
                        topics: owningModule.topics.map((t) => ({
                            id: t.id,
                            completed: t.userProgress.some((p) => p.isCompleted),
                        })),
                    },
                    routeParams.chapterId
                );
            }

            // Gamification: update streak and evaluate badges
            const currentStreak = await updateStreak(userId);

            const badgeEvents: BadgeEvent[] = [
                { type: "topic_completed", topicId: routeParams.chapterId },
                { type: "streak_updated", currentStreak },
            ];

            if (isModuleComplete) {
                badgeEvents.push({ type: "module_completed", moduleId: topic.moduleId });
            }

            // Check if entire course is complete
            if (isModuleComplete) {
                const allModules = await db.module.findMany({
                    where: { courseId: routeParams.courseId, isPublished: true },
                    include: {
                        topics: {
                            where: { isPublished: true },
                            select: {
                                id: true,
                                userProgress: {
                                    where: { userId },
                                    select: { isCompleted: true },
                                },
                            },
                        },
                    },
                });

                // Non-vacuous: a Course with no published Topics at all cannot
                // be complete. Otherwise a draft Course issued a certificate for
                // finishing nothing.
                const isCourseComplete = courseIsComplete(
                    allModules.map((mod) => ({
                        topics: mod.topics.map((t) => ({
                            id: t.id,
                            completed: t.userProgress.some((p) => p.isCompleted),
                        })),
                    })),
                    routeParams.chapterId
                );

                if (isCourseComplete) {
                    badgeEvents.push({ type: "course_completed", courseId: routeParams.courseId });

                    // Through the module, which only promotes from ACTIVE. The
                    // previous updateMany matched on (userId, courseId) alone, so a
                    // SUSPENDED learner could be flipped to COMPLETED and become
                    // eligible for a Certificate.
                    await markCourseCompleted(userId, routeParams.courseId);

                    // Auto-generate certificate on course completion
                    try {
                        await generateCertificate(userId, routeParams.courseId);
                    } catch (err) {
                        logError("CERTIFICATE_AUTO_GENERATE", err);
                    }
                }
            }

            // Evaluate all badge events
            const allAwardedBadges = [];
            for (const event of badgeEvents) {
                const awarded = await evaluateBadges(userId, event);
                allAwardedBadges.push(...awarded);
            }

            return NextResponse.json({
                ...userProgress,
                isModuleComplete,
                moduleName,
                awardedBadges: allAwardedBadges.map((b) => ({
                    id: b.id,
                    name: b.name,
                    description: b.description,
                    type: b.type,
                })),
            });
        }

        return NextResponse.json({
            ...userProgress,
            isModuleComplete,
            moduleName,
            awardedBadges: [],
        });

    } catch (error) {
        return handleRouteError("CHAPTER_ID_PROGRESS", error);
    }
}