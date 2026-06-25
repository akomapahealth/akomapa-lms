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

const adminRoutes = [
  {
    icon: LayoutDashboard,
    label: "Dashboard",
    href: "/admin",
  },
  {
    icon: BookOpen,
    label: "Courses",
    href: "/admin/courses",
  },
  {
    icon: Users,
    label: "Students",
    href: "/admin/students",
  },
  {
    icon: FileQuestion,
    label: "Quizzes",
    href: "/admin/quizzes",
  },
  {
    icon: MessageSquare,
    label: "Community",
    href: "/admin/community",
  },
  {
    icon: BarChart,
    label: "Analytics",
    href: "/admin/analytics",
  },
];

const bottomRoutes = [
  {
    icon: Settings,
    label: "Settings",
    href: "/settings",
  },
];

export const SidebarRoutes = () => {
  const pathname = usePathname();

  const isAdminPage = pathname?.startsWith("/admin");

  const routes = isAdminPage ? adminRoutes : studentRoutes;

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
