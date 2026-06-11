"use client";

import { useUser, useClerk } from "@clerk/nextjs";
import { LogOut } from "lucide-react";
import Image from "next/image";

export const SidebarUserInfo = () => {
  const { user } = useUser();
  const { signOut } = useClerk();

  if (!user) return null;

  return (
    <div className="flex items-center gap-x-3 px-4 py-3">
      {user.imageUrl ? (
        <Image
          src={user.imageUrl}
          alt={user.firstName || "User"}
          width={32}
          height={32}
          className="rounded-full object-cover ring-2 ring-sidebar-border"
        />
      ) : (
        <div className="h-8 w-8 rounded-full bg-sidebar-hover flex items-center justify-center text-sm font-medium text-sidebar-accent">
          {user.firstName?.[0] || "U"}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-sidebar-foreground truncate">
          {user.firstName} {user.lastName}
        </p>
        <p className="text-xs text-sidebar-muted truncate">
          {user.primaryEmailAddress?.emailAddress}
        </p>
      </div>
      <button
        onClick={() => signOut({ redirectUrl: "/sign-in" })}
        className="text-sidebar-muted hover:text-red-400 transition p-1 rounded-md hover:bg-sidebar-hover"
        aria-label="Sign out"
      >
        <LogOut size={16} />
      </button>
    </div>
  );
};
