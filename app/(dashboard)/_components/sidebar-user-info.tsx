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
          className="rounded-full object-cover"
        />
      ) : (
        <div className="h-8 w-8 rounded-full bg-akomapa-teal/20 flex items-center justify-center text-sm font-medium text-akomapa-teal">
          {user.firstName?.[0] || "U"}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-700 truncate">
          {user.firstName} {user.lastName}
        </p>
        <p className="text-xs text-slate-500 truncate">
          {user.primaryEmailAddress?.emailAddress}
        </p>
      </div>
      <button
        onClick={() => signOut({ redirectUrl: "/sign-in" })}
        className="text-slate-400 hover:text-red-500 transition p-1 rounded-md hover:bg-red-50"
        aria-label="Sign out"
      >
        <LogOut size={16} />
      </button>
    </div>
  );
};
