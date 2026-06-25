import { Menu } from "lucide-react";

import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

export const MobileNav = ({ children }: { children: React.ReactNode }) => {
  return (
    <Sheet>
      <SheetTrigger
        className="pr-2 transition hover:opacity-75 md:hidden"
        aria-label="Open navigation"
      >
        <Menu className="h-5 w-5" />
      </SheetTrigger>
      <SheetContent side="left" className="w-72 border-r-0 bg-background p-0">
        {children}
      </SheetContent>
    </Sheet>
  );
};
