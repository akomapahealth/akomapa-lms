import { NavbarRoutes } from "@/components/navbar-routes";
import { Course, Module, Topic, UserProgress } from "@prisma/client";
import { CourseMobileSidebar } from "./course-mobile-sidebar";

type TopicWithProgress = Topic & {
    userProgress: UserProgress[] | null;
};

type ModuleWithTopics = Module & {
    topics: TopicWithProgress[];
};

interface CourseNavbarProps {
    course: Course;
    modules: ModuleWithTopics[];
    progressCount: number;
    isPurchased: boolean;
};

export const CourseNavbar = ({
    course,
    modules,
    progressCount,
    isPurchased,
}: CourseNavbarProps) => {
    return (
        <div className="p-4 border-b h-full flex items-center bg-white shadow-sm">
            <CourseMobileSidebar
                course={course}
                modules={modules}
                progressCount={progressCount}
                isPurchased={isPurchased}
            />
            <NavbarRoutes />
        </div>
    )
}
