"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface Category {
  id: string;
  name: string;
  color: string;
}

interface CategoryTabsProps {
  categories: Category[];
}

export const CategoryTabs = ({ categories }: CategoryTabsProps) => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentCategory = searchParams.get("category") ?? "";

  const onClick = (categoryId: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (categoryId) {
      params.set("category", categoryId);
    } else {
      params.delete("category");
    }
    params.delete("page");
    router.push(`/community?${params.toString()}`);
  };

  return (
    <ScrollArea className="w-full whitespace-nowrap">
      <div className="flex gap-2 pb-2">
        <button
          onClick={() => onClick("")}
          className={cn(
            "px-4 py-1.5 rounded-full text-sm font-medium transition border",
            !currentCategory
              ? "bg-akomapa-teal text-white border-akomapa-teal"
              : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
          )}
        >
          All
        </button>
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => onClick(cat.id)}
            className={cn(
              "px-4 py-1.5 rounded-full text-sm font-medium transition border",
              currentCategory === cat.id
                ? "text-white border-transparent"
                : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
            )}
            style={
              currentCategory === cat.id
                ? { backgroundColor: cat.color, borderColor: cat.color }
                : undefined
            }
          >
            {cat.name}
          </button>
        ))}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
};
