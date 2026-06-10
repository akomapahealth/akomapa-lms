"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { useCallback, useState } from "react";

export const CourseFilter = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [searchValue, setSearchValue] = useState(
    searchParams.get("search") ?? ""
  );

  const currentStatus = searchParams.get("status") ?? "all";
  const currentView = searchParams.get("view") ?? "courses";

  const updateParams = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value && value !== "all" && value !== "courses") {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      router.push(`/courses?${params.toString()}`);
    },
    [router, searchParams]
  );

  const onSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateParams("search", searchValue);
  };

  return (
    <div className="space-y-3">
      <Tabs
        value={currentView}
        onValueChange={(value) => updateParams("view", value)}
      >
        <TabsList>
          <TabsTrigger value="courses">Courses</TabsTrigger>
          <TabsTrigger value="modules">Modules</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <form onSubmit={onSearchSubmit} className="relative w-full sm:w-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder={`Search ${currentView}...`}
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            className="pl-9 w-full sm:w-[250px]"
          />
        </form>

        <Tabs
          value={currentStatus}
          onValueChange={(value) => updateParams("status", value)}
        >
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="in_progress">In Progress</TabsTrigger>
            <TabsTrigger value="completed">Completed</TabsTrigger>
            <TabsTrigger value="not_started">Not Started</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
    </div>
  );
};
