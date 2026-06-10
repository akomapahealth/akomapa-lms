import { NavbarRoutes } from "@/components/navbar-routes";
import { Course, Module, Topic, UserProgress } from "@prisma/client";
import { CourseMobileSidebar } from "./course-mobile-sidebar";
import { type SidebarQuiz } from "./course-sidebar";

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
    quizzes?: SidebarQuiz[];
};

export const CourseNavbar = ({
    course,
    modules,
    progressCount,
    isPurchased,
    quizzes,
}: CourseNavbarProps) => {
    return (
        <div className="p-4 border-b h-full flex items-center bg-white shadow-sm">
            <CourseMobileSidebar
                course={course}
                modules={modules}
                progressCount={progressCount}
                isPurchased={isPurchased}
                quizzes={quizzes}
            />
            <NavbarRoutes />
        </div>
    )
}
