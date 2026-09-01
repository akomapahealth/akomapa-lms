import { NavbarRoutes } from "@/components/navbar-routes";
import { AppShell } from "@/components/shell/app-shell";
import { getStaffCapabilities } from "@/lib/auth";

import { Sidebar } from "./_components/sidebar";

// Authenticated app: render dynamically so pages are never statically
// prerendered at build (the shell renders Clerk client components).
export const dynamic = "force-dynamic";

const DashboardLayout = async ({ children }: { children: React.ReactNode }) => {
  // Derived on the server and handed down as plain booleans. The navigation
  // decides nothing; it renders what it was told (ADR 0001 section 5). Offering
  // a link the principal cannot follow is a bug -- they click it and are
  // bounced, with no explanation.
  const capabilities = await getStaffCapabilities();

  return (
    <AppShell
      sidebar={<Sidebar capabilities={capabilities} />}
      headerContent={
        <NavbarRoutes canAccessStaffArea={capabilities.canAccessStaffArea} />
      }
      collapsible
    >
      {children}
    </AppShell>
  );
};

export default DashboardLayout;
