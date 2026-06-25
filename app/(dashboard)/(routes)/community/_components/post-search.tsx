"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDebounce } from "@/hooks/use-debounce";

export const PostSearch = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(searchParams.get("q") ?? "");
  const debouncedSearch = useDebounce(search, 500);
  const currentSort = searchParams.get("sort") ?? "recent";
  const searchParamsRef = useRef(searchParams);
  searchParamsRef.current = searchParams;

  useEffect(() => {
    const params = new URLSearchParams(searchParamsRef.current.toString());
    const currentQ = params.get("q") ?? "";

    if (debouncedSearch === currentQ) return;

    if (debouncedSearch) {
      params.set("q", debouncedSearch);
    } else {
      params.delete("q");
    }
    params.delete("page");
    router.push(`/community?${params.toString()}`);
  }, [debouncedSearch, router]);

  const onSortChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value !== "recent") {
      params.set("sort", value);
    } else {
      params.delete("sort");
    }
    params.delete("page");
    router.push(`/community?${params.toString()}`);
  };

  return (
    <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
      <div className="relative w-full sm:w-auto">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/70" />
        <Input
          placeholder="Search posts..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 w-full sm:w-[300px]"
        />
      </div>

      <Select value={currentSort} onValueChange={onSortChange}>
        <SelectTrigger className="w-[160px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="recent">Most Recent</SelectItem>
          <SelectItem value="most_liked">Most Liked</SelectItem>
          <SelectItem value="most_discussed">Most Discussed</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
};
