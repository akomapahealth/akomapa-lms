import { AppShell } from "@/components/shell/app-shell";

import { Sidebar } from "./_components/sidebar";

// Authenticated app: render dynamically so pages are never statically
// prerendered at build (the shell renders Clerk client components).
export const dynamic = "force-dynamic";

const DashboardLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <AppShell sidebar={<Sidebar />} collapsible>
      {children}
    </AppShell>
  );
};

export default DashboardLayout;
