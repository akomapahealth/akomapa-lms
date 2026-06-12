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
                "flex items-center gap-x-2 text-sidebar-muted text-sm font-[500] pl-6 w-full transition-all hover:text-sidebar-foreground hover:bg-sidebar-hover",
                isActive && "text-sidebar-foreground bg-sidebar-active hover:bg-sidebar-active"
            )}
        >
            <div className="flex items-center gap-x-2 py-4">
                <Icon
                    size={22}
                    className={cn(
                        "text-sidebar-muted",
                        isActive && "text-sidebar-accent"
                    )}
                />
                {label}
            </div>
            <div
                className={cn(
                    "ml-auto opacity-0 border-2 border-sidebar-accent self-stretch transition-all",
                    isActive && "opacity-100"
                )}
            />
        </button>
    )
}