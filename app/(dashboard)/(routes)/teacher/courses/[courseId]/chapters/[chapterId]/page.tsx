import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Eye, LayoutDashboard, Video } from "lucide-react";

import { db } from "@/lib/db";
import { IconBadge } from "@/components/icon-badge";

import { ChapterTitleForm } from "./_components/chapter-title-form";
import { ChapterDescriptionForm } from "./_components/chapter-description-form";
import { ChapterAccessForm } from "./_components/chapter-access-form";
import { ChapterVideoForm } from "./_components/chapter-video-form";
import { Banner } from "@/components/banner";
import { ChapterActions } from "./_components/chapter-actions";

const ChapterIdPAge = async ({
    params
}: {
    params: Promise<{ courseId: string, chapterId: string }>
}) => {
    const { courseId, chapterId } = await params;


    const { userId } = await auth();

    if (!userId) {
        return redirect("/");
    }

    const chapter = await db.topic.findUnique({
        where: {
            id: chapterId,
        },
        include: {
            muxData: true,
        },
    });

    if (!chapter) {
        return redirect("/");
    }

    const requiredFields = [
        chapter.title,
        chapter.description,
        chapter.videoUrl,
    ]

    const totalFields = requiredFields.length;
    const completedFields = requiredFields.filter(Boolean).length;

    const completionText = `(${completedFields}/${totalFields})`;
    
    const isComplete = requiredFields.every(Boolean);

    return ( 
        <>
            {!chapter.isPublished && (
                <Banner 
                    variant="warning"
                    label="This chapter is not published. It will not be visible in the course"
                />
            )}
            <div className="p-6">
                <div className="flex items-center justify-between">
                    <div className="w-full">
                        <Link
                            href={`/teacher/courses/${courseId}`}
                            className="flex items-center text-sm hover:opacity-75 transition mb-6"
                        >
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            Back to course setup
                        </Link>
                        <div className="flex items-center justify-between w-full">
                            <div className="flex flex-col gap-y-2">
                                <h1 className="text-2xl font-medium">
                                    Create Chapter
                                </h1>
                                <span className="text-sm text-slate">
                                    Complete all fields {completionText}
                                </span>
                            </div>
                            <ChapterActions 
                                disabled={!isComplete}
                                courseId={courseId}
                                chapterId={chapterId}
                                isPublished={chapter.isPublished}
                            />
                        </div>
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-16">
                    <div className="space-y-4">
                        <div>
                            <div className="flex items-center gap-x-2">
                                <IconBadge icon={LayoutDashboard} />
                                <h2 className="text-xl">
                                    Customize your chapter
                                </h2>
                            </div>
                            <ChapterTitleForm 
                                initialData={chapter}
                                courseId={courseId}
                                chapterId={chapterId}
                            />
                            <ChapterDescriptionForm 
                                initialData={chapter}
                                courseId={courseId}
                                chapterId={chapterId}
                            />
                        </div>
                        <div>
                            <div className="flex items-center gap-x-2">
                                <IconBadge icon={Eye} />
                                <h2 className="text-xl">
                                    Access Settings
                                </h2>
                            </div>
                            <ChapterAccessForm 
                                initialData={chapter}
                                courseId={courseId}
                                chapterId={chapterId}
                            />
                        </div>
                    </div>
                    <div>
                        <div className="flex items-center gap-x-2">
                            <IconBadge icon={Video} />
                            <h2 className="text-xl">
                                Add a video
                            </h2>
                        </div>
                        <ChapterVideoForm 
                            initialData={chapter}
                            courseId={courseId}
                            chapterId={chapterId}
                        />
                    </div>
                </div>
            </div>
        </>
    );
}
 
export default ChapterIdPAge;