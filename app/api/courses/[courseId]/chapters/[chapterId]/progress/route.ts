import { NextResponse } from "next/server";

import { z } from "zod";

import { db } from "@/lib/db";
import { requirePrincipal, toResponse } from "@/lib/auth";
import { findPublishedTopicInCourse } from "@/lib/courses/topic-access";
import {
    isCourseComplete as courseIsComplete,
    isModuleComplete as moduleIsComplete,
} from "@/lib/courses/completion";
import { evaluateBadges, type BadgeEvent } from "@/lib/badge-service";
import { updateStreak } from "@/lib/streak-service";
import { generateCertificate } from "@/lib/certificate-service";
import { logError } from "@/lib/logger";

const progressSchema = z.object({
    // Runtime-validated: the value drives Enrollment status and certificate
    // issuance, and JSON will happily deliver a string, a number, or an object.
    isCompleted: z.boolean(),
});

export async function PUT(
    req: Request,
    { params }: { params: Promise<{ courseId: string; chapterId: string }> }
) {
        const routeParams = await params;

    try {
        const { userId } = await requirePrincipal();

        // Published, and in this Course. Without the binding a progress write
        // could be aimed at any Topic in the product by id, and the cascade
        // below -- badges, streaks, Enrollment status, certificate issuance --
        // would run for a Course the learner is not on.
        const topic = await findPublishedTopicInCourse(
            routeParams.courseId,
            routeParams.chapterId
        );

        if (!topic) {
            return new NextResponse("Not Found", { status: 404 });
        }

        // Entitlement. A free-preview Topic is progressable without a purchase;
        // anything else requires one. Enrollment becomes the canonical record
        // in #48, at which point this reads from there instead.
        if (!topic.isFree) {
            const purchase = await db.purchase.findUnique({
                where: {
                    userId_courseId: { userId, courseId: routeParams.courseId },
                },
            });

            if (!purchase) {
                return new NextResponse("Not Found", { status: 404 });
            }
        }

        const parsed = progressSchema.safeParse(await req.json());
        if (!parsed.success) {
            return new NextResponse("Invalid data", { status: 400 });
        }
        const { isCompleted } = parsed.data;

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

                    // Mark enrollment as completed
                    await db.enrollment.updateMany({
                        where: { userId, courseId: routeParams.courseId },
                        data: { status: "COMPLETED" },
                    });

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
        const denied = toResponse(error);
        if (denied) return denied;

        logError("CHAPTER_ID_PROGRESS", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}