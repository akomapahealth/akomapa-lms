import { Menu } from "lucide-react";
import { Course, Topic, UserProgress } from "@prisma/client";

import {
    Sheet,
    SheetContent,
    SheetTrigger
} from "@/components/ui/sheet";

import { CourseSidebar } from "./course-sidebar";

type TopicWithProgress = Topic & {
    userProgress: UserProgress[] | null;
};

interface CourseMobileSidebarProps {
    course: Course;
    topics: TopicWithProgress[];
    progressCount: number;
};

export const CourseMobileSidebar = ({
    course,
    topics,
    progressCount,
}: CourseMobileSidebarProps) => {
        return (
            <Sheet>
                <SheetTrigger className="md:hidden pr-4 hover:opacity-75 transition">
                    <Menu />
                </SheetTrigger>
                <SheetContent side="left" className="p-0 bg-white w-72">
                    <CourseSidebar
                        course={course}
                        topics={topics}
                        progressCount={progressCount}
                    />
                </SheetContent>
            </Sheet>
    );
}
