import { cn } from "@/lib/utils";

import { AppHeader } from "./app-header";

interface AppShellProps {
  sidebar: React.ReactNode;
  /** Replaces the default <NavbarRoutes /> header content */
  headerContent?: React.ReactNode;
  sidebarWidth?: "default" | "wide";
  children: React.ReactNode;
}

/**
 * Shared application shell. The sidebar and header are in normal flow
 * (no fixed positioning), so they can never overlap; only <main> scrolls.
 */
export const AppShell = ({
  sidebar,
  headerContent,
  sidebarWidth = "default",
  children,
}: AppShellProps) => {
  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      <aside
        className={cn(
          "hidden shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex",
          sidebarWidth === "wide" ? "w-80" : "w-60"
        )}
      >
        {sidebar}
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <AppHeader sidebar={sidebar}>{headerContent}</AppHeader>
        <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
};
