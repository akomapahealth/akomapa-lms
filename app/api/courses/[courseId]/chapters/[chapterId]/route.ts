import { Mux } from "@mux/mux-node";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { authorizeTopicInCourse, requirePrincipal } from "@/lib/auth";
import { assertTrustedOrigin, BODY_BYTES, handleRouteError, parseBody, parseParams, problem } from "@/lib/http";
import { hasLearnerRecords, LEARNER_RECORDS_CONFLICT } from "@/lib/courses/learner-records";
import { deleteMuxAssets } from "@/lib/courses/mux-cleanup";
import { enforceRateLimit } from "@/lib/rate-limit";
import { topicParams } from "@/lib/validations/ids";
import { topicUpdateSchema } from "@/lib/validations/topic";

const mux  = new Mux({
    tokenId: process.env.MUX_TOKEN_ID!,
    tokenSecret: process.env.MUX_TOKEN_SECRET!,
});

const Video = mux.video;

export async function DELETE(
    req: Request,
    { params }: { params: Promise<{ courseId: string; chapterId: string }> }
) {
    try {
        assertTrustedOrigin(req);

        const routeParams = parseParams(topicParams, await params);

        const principal = await requirePrincipal();
        await enforceRateLimit(req, "write.default", { userId: principal.userId });

        // Asserts Course ownership AND that the Topic is in that Course. The
        // two used to be separate, so owning any Course was enough to reach a
        // Topic in any other.
        const topic = await authorizeTopicInCourse(
            principal,
            "topic:delete",
            routeParams.courseId,
            routeParams.chapterId
        );

        // Learners' progress and case study attempts outlive the Topic (#51).
        // Checked before anything is touched, for the same reason as the
        // Course delete: the Mux asset used to go first.
        if (await hasLearnerRecords({ kind: "topic", topicId: routeParams.chapterId })) {
            return problem("conflict", { message: LEARNER_RECORDS_CONFLICT.topic });
        }

        const existingMuxData = topic.videoUrl
            ? await db.muxData.findFirst({ where: { topicId: routeParams.chapterId } })
            : null;

        // MuxData cascades with the Topic. The database goes first; if
        // RESTRICT refuses it, the video is untouched.
        const deletedTopic = await db.topic.delete({
            where: {
                id: routeParams.chapterId,
            }
        });

        await deleteMuxAssets(
            existingMuxData ? [existingMuxData.assetId] : [],
            "CHAPTER_ID_DELETE"
        );

        const publishedTopicsInCourse = await db.topic.findMany({
            where: {
                module: { courseId: routeParams.courseId },
                isPublished: true,
            }
        });

        if (!publishedTopicsInCourse.length) {
            await db.course.update({
                where: {
                    id: routeParams.courseId,
                },
                data: {
                    isPublished: false,
                }
            });
        }

        return NextResponse.json(deletedTopic);
    } catch (error) {
        return handleRouteError("CHAPTER_ID_DELETE", error);
    }
}

export async function PATCH(
    req: Request,
    { params }: { params: Promise<{ courseId: string; chapterId: string }> }
) {
    try {
        assertTrustedOrigin(req);

        const routeParams = parseParams(topicParams, await params);

        const principal = await requirePrincipal();
        await enforceRateLimit(req, "write.default", { userId: principal.userId });

        // Course ownership and Topic membership together. Previously the Topic
        // was updated by id alone, so an owner of any Course could edit a Topic
        // belonging to another.
        await authorizeTopicInCourse(
            principal,
            "topic:update",
            routeParams.courseId,
            routeParams.chapterId
        );

        // `textContent` is rich text, so the larger ceiling. `videoUrl` is now
        // required to be an http(s) URL because it is handed to Mux as an asset
        // input below.
        const values = await parseBody(topicUpdateSchema, req, BODY_BYTES.richText);

        const updatedTopic = await db.topic.update({
            where: {
                id: routeParams.chapterId,
            },
            data: values,
        });

        if (values.videoUrl) {
            const existingMuxData = await db.muxData.findFirst({
                where: {
                    topicId: routeParams.chapterId,
                }
            });

            if (existingMuxData) {
                await Video.assets.delete(existingMuxData.assetId);
                await db.muxData.delete({
                    where: {
                        id: existingMuxData.id,
                    }
                });
            }

            const asset = await Video.assets.create({
                input: [{ url: values.videoUrl }],
                playback_policy: ['public'],
                test: false,
            });

            await db.muxData.create({
                data: {
                    topicId: routeParams.chapterId,
                    assetId: asset.id,
                    playbackId: asset.playback_ids?.[0]?.id || 'defaultPlaybackId',
                }
            });
        }

        return NextResponse.json(updatedTopic);

    } catch (error) {
        return handleRouteError("COURSES_CHAPTER_ID", error);
    }
}