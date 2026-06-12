import { AppShell } from "@/components/shell/app-shell";

import { Sidebar } from "./_components/sidebar";

const DashboardLayout = ({ children }: { children: React.ReactNode }) => {
  return <AppShell sidebar={<Sidebar />}>{children}</AppShell>;
};

export default DashboardLayout;
