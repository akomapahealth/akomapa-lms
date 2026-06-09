import { Logo } from "./logo";
import { SidebarRoutes } from "./sidebar-routes";


export const Sidebar = () => {
    return (
        <div className="h-full border-r border-akomapa-light-blue/30 flex flex-col overflow-y-auto bg-white shadow-sm">
            <div className="p-6 border-b border-akomapa-ice">
                <Logo />
            </div>
            <div className="flex flex-col w-full flex-1">
                <SidebarRoutes />
            </div>
        </div>
    )
}
