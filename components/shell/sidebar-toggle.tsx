"use client";

import { PanelLeft, PanelLeftClose } from "lucide-react";

import { useSidebar } from "./sidebar-context";

export const SidebarToggle = () => {
  const { collapsed, collapsible, toggle } = useSidebar();

  if (!collapsible) return null;

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      aria-pressed={collapsed}
      className="hidden h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground md:inline-flex"
    >
      {collapsed ? (
        <PanelLeft className="h-5 w-5" />
      ) : (
        <PanelLeftClose className="h-5 w-5" />
      )}
    </button>
  );
};
