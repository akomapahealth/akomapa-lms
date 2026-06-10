import { isFaculty } from "@/lib/roles";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

const TeacherLayout = async ({
    children
}: {
    children: React.ReactNode;
}) => {
    const { userId } = await auth();

    if (!userId) {
        return redirect("/sign-in");
    }

    if (!(await isFaculty(userId))) {
        return redirect("/");
    }

    return <>{children}</>;
}

export default TeacherLayout;