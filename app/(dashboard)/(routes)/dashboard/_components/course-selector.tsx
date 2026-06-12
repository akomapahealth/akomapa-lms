"use client";

import { useRouter, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface CourseOption {
  id: string;
  title: string;
}

interface CourseSelectorProps {
  courses: CourseOption[];
  selectedCourseId?: string;
}

export const CourseSelector = ({
  courses,
  selectedCourseId,
}: CourseSelectorProps) => {
  const router = useRouter();
  const searchParams = useSearchParams();

  const onChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "all") {
      params.delete("courseId");
    } else {
      params.set("courseId", value);
    }
    router.push(`/?${params.toString()}`);
  };

  return (
    <Select
      value={selectedCourseId || "all"}
      onValueChange={onChange}
    >
      <SelectTrigger className="w-full md:w-[300px]">
        <SelectValue placeholder="Select a course" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All Courses</SelectItem>
        {courses.map((course) => (
          <SelectItem key={course.id} value={course.id}>
            {course.title}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
