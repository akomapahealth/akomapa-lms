"use client";

import {
  BarChart,
  BookHeart,
  BookOpen,
  Compass,
  ExternalLink,
  FileQuestion,
  GraduationCap,
  LayoutDashboard,
  Map,
  MessageSquare,
  Settings,
  Users,
} from "lucide-react";
import { usePathname } from "next/navigation";

import { useSidebar } from "@/components/shell/sidebar-context";
import type { StaffCapabilities } from "@/lib/auth";
import { cn } from "@/lib/utils";

import { SidebarItem } from "./sidebar-item";

const studentRoutes = [
  {
    icon: LayoutDashboard,
    label: "Dashboard",
    href: "/dashboard",
  },
  {
    icon: BookOpen,
    label: "Courses",
    href: "/courses",
  },
  {
    icon: GraduationCap,
    label: "Grades",
    href: "/grades",
  },
  {
    icon: Compass,
    label: "Browse",
    href: "/search",
  },
  {
    icon: Users,
    label: "Community",
    href: "/community",
  },
  {
    icon: BookHeart,
    label: "Journal",
    href: "/journal",
  },
  {
    icon: Map,
    label: "Learning Path",
    href: "/learning-path",
  },
];

/**
 * Staff navigation.
 *
 * `visible` names the capability each destination needs. Every entry used to be
 * shown to anyone on an /admin path, which meant a faculty member saw Students,
 * Community, and Analytics -- all ADMIN-only -- and was redirected on click.
 * The capabilities are computed on the server and passed down; nothing here
 * decides anything.
 */
const adminRoutes: Array<{
  icon: typeof LayoutDashboard;
  label: string;
  href: string;
  visible: (capabilities: StaffCapabilities) => boolean;
}> = [
  {
    icon: LayoutDashboard,
    label: "Dashboard",
    href: "/admin",
    visible: (c) => c.canAccessStaffArea,
  },
  {
    icon: BookOpen,
    label: "Courses",
    href: "/admin/courses",
    visible: (c) => c.canAccessStaffArea,
  },
  {
    icon: Users,
    label: "Students",
    href: "/admin/students",
    visible: (c) => c.canAdministerLearners,
  },
  {
    icon: FileQuestion,
    label: "Quizzes",
    href: "/admin/quizzes",
    visible: (c) => c.canAccessStaffArea,
  },
  {
    icon: MessageSquare,
    label: "Community",
    href: "/admin/community",
    visible: (c) => c.canModerateCommunity,
  },
  {
    icon: BarChart,
    label: "Analytics",
    href: "/admin/analytics",
    visible: (c) => c.canReadAnalytics,
  },
];

const bottomRoutes = [
  {
    icon: Settings,
    label: "Settings",
    href: "/settings",
  },
];

export const SidebarRoutes = ({
  capabilities,
}: {
  capabilities: StaffCapabilities;
}) => {
  const pathname = usePathname();

  const isAdminPage = pathname?.startsWith("/admin");

  const routes = isAdminPage
    ? adminRoutes.filter((route) => route.visible(capabilities))
    : studentRoutes;

  return (
    <div className="flex w-full flex-col gap-y-1 px-3 py-4">
      {routes.map((route) => (
        <SidebarItem
          key={route.href}
          icon={route.icon}
          label={route.label}
          href={route.href}
        />
      ))}
    </div>
  );
};

export const SidebarBottomRoutes = () => {
  const { collapsed } = useSidebar();

  return (
    <div className="flex w-full flex-col gap-y-1 px-3 py-2">
      {bottomRoutes.map((route) => (
        <SidebarItem
          key={route.href}
          icon={route.icon}
          label={route.label}
          href={route.href}
        />
      ))}
      <a
        href="https://www.akomapa.org"
        target="_blank"
        rel="noopener noreferrer"
        title={collapsed ? "Akomapa.org" : undefined}
        className={cn(
          "flex w-full items-center gap-x-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-muted transition-colors hover:bg-sidebar-hover hover:text-sidebar-foreground",
          collapsed && "justify-center px-0"
        )}
      >
        <ExternalLink size={18} className="shrink-0 text-sidebar-muted" />
        {!collapsed && <span className="truncate">Akomapa.org</span>}
      </a>
    </div>
  );
};
