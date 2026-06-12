import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { db } from "@/lib/db";

import { Categories } from "./_components/categories";
import { SearchInput } from "@/components/search-input";
import { getCourses } from "@/actions/get-courses";
import { CoursesList } from "@/components/courses-list";
import { PageContainer } from "@/components/shell/page-container";


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
        return redirect("/dashboard");
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
            <PageContainer width="wide" className="space-y-4">
                <div className="sticky top-0 z-10 -mx-4 bg-background/90 px-4 py-2 backdrop-blur-sm sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
                    <Suspense fallback={null}>
                        <Categories
                            items={categories}
                        />
                    </Suspense>
                </div>
                <CoursesList 
                    items={courses}
                />
            </PageContainer>
        </>
     );
}
 
export default SearchPage;