"use client";

import {
  BarChart,
  BookHeart,
  BookOpen,
  Compass,
  FileQuestion,
  GraduationCap,
  LayoutDashboard,
  MessageSquare,
  Settings,
  Users,
} from "lucide-react";
import { usePathname } from "next/navigation";

import { SidebarItem } from "./sidebar-item";

const studentRoutes = [
  {
    icon: LayoutDashboard,
    label: "Dashboard",
    href: "/",
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
    <div className="flex flex-col w-full">
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
  return (
    <div className="flex flex-col w-full">
      {bottomRoutes.map((route) => (
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
