import { Logo } from "./logo";
import { SidebarRoutes, SidebarBottomRoutes } from "./sidebar-routes";
import { SidebarUserInfo } from "./sidebar-user-info";

export const Sidebar = () => {
  return (
    <div className="h-full border-r border-akomapa-light-blue/30 flex flex-col overflow-y-auto bg-gradient-to-b from-white to-akomapa-ice/20 shadow-sm">
      <div className="p-6 border-b border-akomapa-ice">
        <Logo />
      </div>
      <div className="flex flex-col w-full flex-1">
        <SidebarRoutes />
      </div>
      <div className="border-t border-akomapa-ice">
        <SidebarBottomRoutes />
        <SidebarUserInfo />
      </div>
    </div>
  );
};
