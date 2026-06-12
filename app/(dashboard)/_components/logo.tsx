import { BrandMark } from "@/components/brand/logo";

export const Logo = () => {
    return (
        <div className="flex items-center gap-x-2.5">
            <BrandMark size={36} />
            <div className="flex flex-col">
                <span className="text-sm font-semibold text-sidebar-foreground tracking-tight leading-tight">
                    Akomapa
                </span>
                <span className="text-[10px] font-medium text-sidebar-muted leading-tight">
                    Academy
                </span>
            </div>
        </div>
    )
}
