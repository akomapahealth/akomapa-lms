import { Menu } from "lucide-react";
import { Course, Module, Topic, UserProgress } from "@prisma/client";

import {
    Sheet,
    SheetContent,
    SheetTrigger
} from "@/components/ui/sheet";

import { CourseSidebar, type SidebarQuiz } from "./course-sidebar";

type TopicWithProgress = Topic & {
    userProgress: UserProgress[] | null;
};

type ModuleWithTopics = Module & {
    topics: TopicWithProgress[];
};

interface CourseMobileSidebarProps {
    course: Course;
    modules: ModuleWithTopics[];
    progressCount: number;
    isPurchased: boolean;
    quizzes?: SidebarQuiz[];
};

export const CourseMobileSidebar = ({
    course,
    modules,
    progressCount,
    isPurchased,
    quizzes,
}: CourseMobileSidebarProps) => {
        return (
            <Sheet>
                <SheetTrigger className="md:hidden pr-4 hover:opacity-75 transition">
                    <Menu />
                </SheetTrigger>
                <SheetContent side="left" className="p-0 bg-white w-72">
                    <CourseSidebar
                        course={course}
                        modules={modules}
                        progressCount={progressCount}
                        isPurchased={isPurchased}
                        quizzes={quizzes}
                    />
                </SheetContent>
            </Sheet>
    );
}
