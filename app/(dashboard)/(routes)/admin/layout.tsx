import { requirePageCapability } from "@/lib/auth";

/**
 * The staff area shell.
 *
 * This gate admits anyone who may see *some* staff page. It deliberately does
 * not decide what they may see once inside: each page below declares its own
 * capability. Previously this layout gated on `isAdmin || isFaculty` -- which,
 * because `isFaculty` returns true for ADMIN, reduced to "FACULTY or better" --
 * and seven of the nine pages beneath it had no check of their own, so any
 * faculty member could reach every administration page.
 */
const AdminLayout = async ({ children }: { children: React.ReactNode }) => {
  await requirePageCapability("staff:access");

  return <>{children}</>;
};

export default AdminLayout;
