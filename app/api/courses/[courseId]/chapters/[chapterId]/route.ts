import { Mux } from "@mux/mux-node";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { authorizeTopicInCourse, requirePrincipal, toResponse } from "@/lib/auth";
import { topicUpdateSchema } from "@/lib/validations/topic";
import { logError } from "@/lib/logger";

const mux  = new Mux({
    tokenId: process.env.MUX_TOKEN_ID!,
    tokenSecret: process.env.MUX_TOKEN_SECRET!,
});

const Video = mux.video;

export async function DELETE(
    req: Request,
    { params }: { params: Promise<{ courseId: string; chapterId: string }> }
) {
        const routeParams = await params;

    try {
        const principal = await requirePrincipal();

        // Asserts Course ownership AND that the Topic is in that Course. The
        // two used to be separate, so owning any Course was enough to reach a
        // Topic in any other.
        const topic = await authorizeTopicInCourse(
            principal,
            "topic:delete",
            routeParams.courseId,
            routeParams.chapterId
        );

        if (topic.videoUrl) {
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
        }

        const deletedTopic = await db.topic.delete({
            where: {
                id: routeParams.chapterId,
            }
        });

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
        const denied = toResponse(error);
        if (denied) return denied;

        logError("CHAPTER_ID_DELETE", error);

        return new NextResponse("Internal Error", { status: 500 });
    }
}

export async function PATCH(
    req: Request,
    { params }: { params: Promise<{ courseId: string; chapterId: string }> }
) {
        const routeParams = await params;

    try {
        const principal = await requirePrincipal();

        // Course ownership and Topic membership together. Previously the Topic
        // was updated by id alone, so an owner of any Course could edit a Topic
        // belonging to another.
        await authorizeTopicInCourse(
            principal,
            "topic:update",
            routeParams.courseId,
            routeParams.chapterId
        );

        const body = await req.json();
        const parsed = topicUpdateSchema.safeParse(body);
        if (!parsed.success) {
            return new NextResponse("Invalid data", { status: 400 });
        }

        const updatedTopic = await db.topic.update({
            where: {
                id: routeParams.chapterId,
            },
            data: parsed.data,
        });

        if (parsed.data.videoUrl) {
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
                input: [{ url: parsed.data.videoUrl! }],
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
        const denied = toResponse(error);
        if (denied) return denied;

        logError("COURSES_CHAPTER_ID", error);

        return new NextResponse("Internal Error", { status: 500 });
    }
}