import { requirePageCapability } from "@/lib/auth";

const TeacherLayout = async ({ children }: { children: React.ReactNode }) => {
  await requirePageCapability("staff:access");

  return <>{children}</>;
};

export default TeacherLayout;
