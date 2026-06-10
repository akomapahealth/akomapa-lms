import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { File } from "lucide-react";

import { getTopic } from "@/actions/get-topic";
import { Banner } from "@/components/banner";
import { Separator } from "@/components/ui/separator";
import { Preview } from "@/components/preview";

import { VideoPlayer } from "./_components/video-player";
import { CourseEnrollButton } from "./_components/course-enroll-button";
import { CourseProgressButton } from "./_components/course-progress-button";

const ChapterIdPage = async ({
    params
}: {
    params: Promise<{ courseId: string, chapterId: string }>
}) => {
    const { courseId, chapterId } = await params;

    const { userId } = await auth();

    if (!userId) {
        return redirect("/");
    }

    const {
        topic,
        course,
        muxData,
        attachments,
        nextTopic,
        userProgress,
        purchase,
    } = await getTopic({
        userId,
        topicId: chapterId,
        courseId: courseId,
    });

    if (!topic || !course) {
        return redirect("/");
    }

    const isLocked = !topic.isFree && !purchase;
    const completeOnEnd = !!purchase && !userProgress?.isCompleted;
    return (
        <div>
            {userProgress?.isCompleted && (
                <Banner
                    variant="success"
                    label="You already completed this topic"
                />
            )}
            {isLocked && (
                <Banner
                    variant="warning"
                    label="You need to purchase this course to watch this topic"
                />
            )}

            <div className="flex flex-col max-w-4xl mx-auto pb-20">
                <div className="p-4">
                    <VideoPlayer
                        topicId={chapterId}
                        title={topic.title}
                        courseId={courseId}
                        nextTopicId={nextTopic?.id}
                        playbackId={muxData?.playbackId!}
                        isLocked={isLocked}
                        completeOnEnd={completeOnEnd}
                    />
                </div>
                <div>
                    <div className="p-4 flex flex-col md:flex-row items-center justify-between">
                        <h2 className="text-2xl font-semibold mb-2">
                            {topic.title}
                        </h2>
                        {purchase ? (
                            <CourseProgressButton
                                topicId={chapterId}
                                courseId={courseId}
                                nextTopicId={nextTopic?.id}
                                isCompleted={!!userProgress?.isCompleted}
                            />
                        ): (
                            <CourseEnrollButton
                                courseId={courseId}
                                price={course.price!}
                            />
                        )}
                    </div>
                    <Separator />
                    <div>
                        <Preview value={topic.description!} />
                    </div>
                    {!!attachments.length && (
                        <>
                            <Separator />
                            <div className="p-4">
                                {attachments.map((attachment) => (
                                    <a
                                        href={attachment.url}
                                        target="_blank"
                                        key={attachment.id}
                                        className="flex items-center p-3 w-full bg-sky-200 border text-sky-700 rounded-md hover:underline"
                                    >
                                        <File />
                                        <p className="line-clamp-1">
                                            {attachment.name}
                                        </p>
                                    </a>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
     );
}

export default ChapterIdPage;
