import { Mux } from "@mux/mux-node";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";

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
        const { userId } = await auth();

        if (!userId) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const ownCourse = await db.course.findUnique({
            where: {
                id: routeParams.courseId,
                userId,
            }
        });

        if (!ownCourse) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const topic = await db.topic.findUnique({
            where:{
                id: routeParams.chapterId,
            }
        });

        if (!topic) {
            return new NextResponse("Topic Not Found", { status: 404 });
        }

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
        console.log("[CHAPTER_ID_DELETE]", error);

        return new NextResponse("Internal Error", { status: 500 });
    }
}

export async function PATCH(
    req: Request,
    { params }: { params: Promise<{ courseId: string; chapterId: string }> }
) {
        const routeParams = await params;

    try {
        const { userId } = await auth();

        const { isPublished, ...values } = await req.json();

        if (!userId) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const ownCourse = await db.course.findUnique({
            where: {
                id: routeParams.courseId,
                userId
            }
        });

        if (!ownCourse) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const updatedTopic = await db.topic.update({
            where: {
                id: routeParams.chapterId,
            },
            data: {
                ...values,
            }
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
                input: values.videoUrl,
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
        console.log("[COURSES_CHAPTER_ID]", error);

        return new NextResponse("Internal Error", { status: 500 });
    }
}