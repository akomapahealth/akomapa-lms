import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { db } from "@/lib/db";

import { Categories } from "./_components/categories";
import { SearchInput } from "@/components/search-input";
import { getCourses } from "@/actions/get-courses";
import { CoursesList } from "@/components/courses-list";


interface SearchPageProps {
    searchParams: Promise<{
        title?: string;
        categoryId?: string;
    }>
}

const SearchPage = async ({
    searchParams
}: SearchPageProps) => {
    const { userId } = await auth();

    if (!userId) {
        return redirect("/");
    }
    const categories = await db.category.findMany({
        orderBy: {
            name: "asc",
        }
    });

    const params = await searchParams;
    const courses = await getCourses({
        userId,
        ...params,
    });

    return (
        <> 
            <div className="px-6 pt-6 md:hidden md:mb-0 block">
                <Suspense fallback={null}>
                    <SearchInput />
                </Suspense>
            </div>
            <div className="p-6 space-y-4">
                <Suspense fallback={null}>
                    <Categories 
                        items={categories}
                    />
                </Suspense>
                <CoursesList 
                    items={courses}
                />
            </div>
        </>
     );
}
 
export default SearchPage;