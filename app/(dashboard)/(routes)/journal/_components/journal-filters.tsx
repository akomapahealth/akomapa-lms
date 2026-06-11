"use client";

import { useRouter, useSearchParams } from "next/navigation";
import qs from "query-string";
import { Search } from "lucide-react";
import { useDebounce } from "@/hooks/use-debounce";
import { useEffect, useState } from "react";

interface JournalFiltersProps {
  courses: { id: string; title: string }[];
}

export const JournalFilters = ({ courses }: JournalFiltersProps) => {
  const router = useRouter();
  const searchParams = useSearchParams();

  const currentCourseId = searchParams.get("courseId") || "";
  const currentSearch = searchParams.get("search") || "";

  const [search, setSearch] = useState(currentSearch);
  const debouncedSearch = useDebounce(search, 500);

  useEffect(() => {
    const url = qs.stringifyUrl(
      {
        url: "/journal",
        query: {
          courseId: currentCourseId || undefined,
          search: debouncedSearch || undefined,
        },
      },
      { skipEmptyString: true, skipNull: true }
    );
    router.push(url);
  }, [debouncedSearch, currentCourseId, router]);

  const onCourseChange = (courseId: string) => {
    const url = qs.stringifyUrl(
      {
        url: "/journal",
        query: {
          courseId: courseId || undefined,
          search: search || undefined,
        },
      },
      { skipEmptyString: true, skipNull: true }
    );
    router.push(url);
  };

  return (
    <div className="flex flex-col sm:flex-row gap-3">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <input
          type="text"
          placeholder="Search entries..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-akomapa-teal/20 focus:border-akomapa-teal"
        />
      </div>
      <select
        value={currentCourseId}
        onChange={(e) => onCourseChange(e.target.value)}
        className="px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-akomapa-teal/20 focus:border-akomapa-teal"
      >
        <option value="">All Courses</option>
        {courses.map((course) => (
          <option key={course.id} value={course.id}>
            {course.title}
          </option>
        ))}
      </select>
    </div>
  );
};
