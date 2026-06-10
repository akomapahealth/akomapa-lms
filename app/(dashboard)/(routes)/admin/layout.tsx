import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { isAdmin, isFaculty } from "@/lib/roles";

const AdminLayout = async ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const { userId } = await auth();

  if (!userId) {
    return redirect("/sign-in");
  }

  const hasAccess = (await isAdmin(userId)) || (await isFaculty(userId));

  if (!hasAccess) {
    return redirect("/");
  }

  return <>{children}</>;
};

export default AdminLayout;
