"use client";

import Image from "next/image";

import { useSidebar } from "@/components/shell/sidebar-context";

export const Logo = () => {
    const { collapsed } = useSidebar();

    if (collapsed) {
        return (
            <div className="flex items-center justify-center p-3">
                <Image
                    src="/logo/mark.png"
                    alt="Akomapa Academy"
                    width={466}
                    height={444}
                    className="h-10 w-auto"
                />
            </div>
        );
    }

    return (
        <div className="p-6">
            <Image
                src="/logo/wordmark-footer.svg"
                alt="Akomapa Academy"
                width={784}
                height={329}
                unoptimized
                className="h-9 w-auto"
            />
        </div>
    );
};
