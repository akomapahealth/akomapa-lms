"use client";

import { cn } from "@/lib/utils";

import { AppHeader } from "./app-header";
import { SidebarProvider, useSidebar } from "./sidebar-context";

interface AppShellProps {
  sidebar: React.ReactNode;
  /** Replaces the default <NavbarRoutes /> header content */
  headerContent?: React.ReactNode;
  sidebarWidth?: "default" | "wide";
  /** Enables the desktop collapsible icon rail (nav-style sidebars only). */
  collapsible?: boolean;
  children: React.ReactNode;
}

/**
 * Shared application shell. The sidebar and header are in normal flow
 * (no fixed positioning), so they can never overlap; only <main> scrolls.
 *
 * Desktop sidebar visibility is enforced by the `.app-shell-sidebar` rule
 * in globals.css (plain CSS, not utility classes) so it cannot be lost to
 * class purging or specificity conflicts. The width (full vs collapsed
 * rail) is driven here by the sidebar context.
 */
export const AppShell = ({ collapsible = false, ...props }: AppShellProps) => {
  return (
    <SidebarProvider collapsible={collapsible}>
      <ShellInner {...props} />
    </SidebarProvider>
  );
};

const ShellInner = ({
  sidebar,
  headerContent,
  sidebarWidth = "default",
  children,
}: Omit<AppShellProps, "collapsible">) => {
  const { collapsed } = useSidebar();

  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      {/* Sidebar surface (bg/text) is owned by the sidebar component itself */}
      <aside
        className={cn(
          "app-shell-sidebar shrink-0 flex-col transition-[width] duration-300 ease-out",
          collapsed
            ? "w-[4.5rem]"
            : sidebarWidth === "wide"
              ? "w-80"
              : "w-64"
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
