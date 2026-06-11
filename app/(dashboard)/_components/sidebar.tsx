import { Logo } from "./logo";
import { SidebarRoutes, SidebarBottomRoutes } from "./sidebar-routes";
import { SidebarUserInfo } from "./sidebar-user-info";

export const Sidebar = () => {
  return (
    <div className="h-full border-r border-sidebar-border flex flex-col overflow-y-auto bg-sidebar text-sidebar-foreground shadow-lg">
      <div className="p-6 border-b border-sidebar-border">
        <Logo />
      </div>
      <div className="flex flex-col w-full flex-1">
        <SidebarRoutes />
      </div>
      <div className="border-t border-sidebar-border">
        <SidebarBottomRoutes />
        <SidebarUserInfo />
      </div>
    </div>
  );
};
