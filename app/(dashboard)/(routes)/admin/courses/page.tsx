import { db } from "@/lib/db";
import { requirePageCapability } from "@/lib/auth";
import { columns } from "@/components/admin/columns";
import { DataTable } from "@/components/admin/data-table";
import { PageContainer } from "@/components/shell/page-container";

const AdminCoursesPage = async () => {
  const principal = await requirePageCapability("staff:access");

  const courses = await db.course.findMany({
    where: {
      userId: principal.userId,
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
