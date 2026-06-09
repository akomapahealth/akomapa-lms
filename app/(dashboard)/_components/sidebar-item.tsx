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

    const isActive = 
        (pathname === "/" && href === "/") ||
        (pathname ===href) ||
        (pathname?.startsWith(`${href}/`));

    const onClick = () => {
        router.push(href);
    }

    return (
        <button
            onClick={onClick}
            type="button"
            className={cn(
                "flex items-center gap-x-2 text-slate-500 text-sm font-[500] pl-6 w-full transition-all hover:text-akomapa-teal hover:bg-akomapa-ice/50", 
                isActive && "text-akomapa-teal bg-akomapa-ice/50 hover:bg-akomapa-ice/50 hover:text-akomapa-teal"
            )}
        >
            <div className="flex items-center gap-x-2 py-4">
                <Icon
                    size={22}
                    className={cn(
                        "text-slate-500",
                        isActive && "text-akomapa-teal"
                    )}
                />
                {label}
            </div>
            <div 
                className={cn(
                    "ml-auto opacity-0 border-2 border-akomapa-teal self-stretch transition-all",
                    isActive && "opacity-100"
                )}
            />
        </button>
    )
}