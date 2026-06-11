import { NavbarRoutes } from "@/components/navbar-routes"
import { MobileSidebar } from "./mobile-sidebar"

export const Navbar = () => {
    return (
        <div className="px-4 sm:px-6 border-b border-border/50 h-full flex items-center bg-white/80 backdrop-blur-sm">
            <MobileSidebar />
            <NavbarRoutes />
        </div>
    )
}