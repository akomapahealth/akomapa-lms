import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { columns } from "@/components/admin/columns";
import { DataTable } from "@/components/admin/data-table";
import { PageContainer } from "@/components/shell/page-container";

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
    <PageContainer width="wide">
      <DataTable columns={columns} data={courses} />
    </PageContainer>
  );
};

export default AdminCoursesPage;
