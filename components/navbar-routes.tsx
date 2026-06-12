"use client";

import { Suspense } from "react";
import { UserButton, useAuth, useUser } from "@clerk/nextjs";
import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { isAdminClient } from "@/lib/roles-client";

import { SearchInput } from "./search-input";

export const NavbarRoutes = () => {
  const { userId } = useAuth();
  const { user } = useUser();
  const pathname = usePathname();

  const isAdminPage = pathname?.startsWith("/admin");
  const isCoursePage = pathname?.includes("/courses");
  const isSearchPage = pathname === "/search";

  return (
    <>
      {isSearchPage && (
        <div className="hidden md:block flex-1 max-w-md mx-4">
          <Suspense fallback={null}>
            <SearchInput />
          </Suspense>
        </div>
      )}
      <div className="flex gap-x-2 ml-auto">
        {isAdminPage || isCoursePage ? (
          <Link href="/dashboard">
            <Button size="sm" variant="ghost">
              <LogOut className="h-4 w-4 mr-2" />
              Exit
            </Button>
          </Link>
        ) : isAdminClient(user?.publicMetadata) ? (
          <Link href="/admin/courses">
            <Button size="sm" variant="ghost">
              Admin
            </Button>
          </Link>
        ) : !userId ? (
          <Link href="/sign-in">
            <Button size="sm" variant="ghost">
              Sign In
            </Button>
          </Link>
        ) : null}
        <ThemeToggle />
        <UserButton />
      </div>
    </>
  );
};
