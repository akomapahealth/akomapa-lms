import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { db } from "@/lib/db";
import { isAdmin } from "@/lib/roles";
import { StudentTable } from "./_components/student-table";

const AdminStudentsPage = async () => {
  const { userId } = await auth();
  if (!userId) return redirect("/sign-in");

  const admin = await isAdmin(userId);
  if (!admin) return redirect("/");

  const students = await db.user.findMany({
    where: { role: "STUDENT" },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      imageUrl: true,
      role: true,
      createdAt: true,
      enrollments: {
        select: { id: true },
      },
      progress: {
        select: { isCompleted: true },
      },
    },
  });

  const studentRows = students.map((student) => {
    const totalTopics = student.progress.length;
    const completedTopics = student.progress.filter((p) => p.isCompleted).length;
    const overallProgress =
      totalTopics > 0 ? Math.round((completedTopics / totalTopics) * 100) : 0;

    return {
      id: student.id,
      firstName: student.firstName,
      lastName: student.lastName,
      email: student.email,
      imageUrl: student.imageUrl,
      role: student.role,
      enrolledCourses: student.enrollments.length,
      overallProgress,
      createdAt: student.createdAt,
    };
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">
          Students ({students.length})
        </h1>
      </div>

      <StudentTable students={studentRows} />
    </div>
  );
};

export default AdminStudentsPage;
