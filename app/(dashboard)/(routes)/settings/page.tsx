import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { getUserSettings } from "@/actions/get-user-settings";

import { SettingsForm } from "./_components/settings-form";

const SettingsPage = async () => {
  const { userId } = await auth();

  if (!userId) {
    return redirect("/sign-in");
  }

  const settings = await getUserSettings(userId);

  return (
    <div className="px-4 py-6 sm:p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your preferences and notifications
        </p>
      </div>
      <SettingsForm initialSettings={settings} />
    </div>
  );
};

export default SettingsPage;
