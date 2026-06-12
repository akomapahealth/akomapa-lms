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
 *
 * Desktop sidebar visibility is enforced by the `.app-shell-sidebar` rule
 * in globals.css (plain CSS, not utility classes) so it cannot be lost to
 * class purging or specificity conflicts.
 */
export const AppShell = ({
  sidebar,
  headerContent,
  sidebarWidth = "default",
  children,
}: AppShellProps) => {
  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      {/* Sidebar surface (bg/text) is owned by the sidebar component itself */}
      <aside
        className={cn(
          "app-shell-sidebar shrink-0 flex-col",
          sidebarWidth === "wide" ? "w-80" : "w-64"
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
