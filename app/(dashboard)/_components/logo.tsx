import Image from "next/image";

export const Logo = () => {
    return (
        <div className="flex items-center gap-x-2">
            <Image
                height={36}
                width={36}
                alt="Akomapa Academy"
                src="/akomapa-logo.png"
                className="object-contain brightness-0 invert"
                style={{ width: "36px", height: "36px" }}
                priority
            />
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