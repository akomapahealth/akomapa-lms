"use client";

import { LucideIcon } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";

import { cn } from "@/lib/utils";


interface SidebarItemProps {
    icon: LucideIcon;
    label: string;
    href: string;
}

export const SidebarItem = ({
    icon: Icon,
    label,
    href,
}: SidebarItemProps) => {
    const pathname = usePathname();
    const router = useRouter();

    // Index-style routes only highlight on exact match so they don't
    // stay active on every child page (e.g. /admin on /admin/courses).
    const indexRoutes = ["/dashboard", "/admin"];
    const isActive =
        pathname === href ||
        (!indexRoutes.includes(href) && pathname?.startsWith(`${href}/`));

    const onClick = () => {
        router.push(href);
    }

    return (
        <button
            onClick={onClick}
            type="button"
            className={cn(
                "flex w-full items-center gap-x-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-muted transition-colors hover:bg-sidebar-hover hover:text-sidebar-foreground",
                isActive && "bg-sidebar-active text-sidebar-foreground hover:bg-sidebar-active"
            )}
        >
            <Icon
                size={18}
                className={cn(
                    "shrink-0 text-sidebar-muted transition-colors",
                    isActive && "text-sidebar-accent"
                )}
            />
            {label}
        </button>
    )
}