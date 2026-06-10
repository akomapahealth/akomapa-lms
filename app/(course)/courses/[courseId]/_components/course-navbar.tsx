import { NavbarRoutes } from "@/components/navbar-routes";
import { Course, Topic, UserProgress } from "@prisma/client"
import { CourseMobileSidebar } from "./course-mobile-sidebar";

type TopicWithProgress = Topic & {
    userProgress: UserProgress[] | null;
};

interface CourseNavbarProps {
    course: Course;
    topics: TopicWithProgress[];
    progressCount: number;
};

export const CourseNavbar = ({
    course,
    topics,
    progressCount,
}: CourseNavbarProps) => {
    return (
        <div className="p-4 border-b h-full flex items-center bg-white shadow-sm">
            <CourseMobileSidebar
                course={course}
                topics={topics}
                progressCount={progressCount}
            />
            <NavbarRoutes />
        </div>
    )
}
