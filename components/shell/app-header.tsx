import { NavbarRoutes } from "@/components/navbar-routes";

import { MobileNav } from "./mobile-nav";

interface AppHeaderProps {
  /** Sidebar node rendered inside the mobile drawer */
  sidebar: React.ReactNode;
  children?: React.ReactNode;
}

export const AppHeader = ({ sidebar, children }: AppHeaderProps) => {
  return (
    <header className="z-30 flex h-[var(--header-height)] shrink-0 items-center gap-x-2 border-b border-border/60 bg-background/80 px-4 backdrop-blur-md sm:px-6">
      <MobileNav>{sidebar}</MobileNav>
      {children ?? <NavbarRoutes />}
    </header>
  );
};
