import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { columns } from "@/app/(dashboard)/(routes)/teacher/courses/_components/columns";
import { DataTable } from "@/app/(dashboard)/(routes)/teacher/courses/_components/data-table";

const AdminCoursesPage = async () => {
  const { userId } = await auth();

  if (!userId) {
    return redirect("/sign-in");
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
    <div className="p-6">
      <DataTable columns={columns} data={courses} />
    </div>
  );
};

export default AdminCoursesPage;
