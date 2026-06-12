import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { db } from "@/lib/db";

import { DataTable } from "@/components/admin/data-table";
import { columns } from "@/components/admin/columns"; 


const CoursesPage = async () => {
    const { userId } = await auth();

    if (!userId) {
        return redirect("/dashboard");
    }

    const courses = await db.course.findMany({
        where: {
            userId,
        },
        orderBy: {
            createdAt: "desc",
        },
    });
    return ( 
        <div className="px-4 py-6 sm:p-6">
            <DataTable columns={columns} data={courses} />
        </div>
     );
}
 
export default CoursesPage;