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
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Settings</h1>
        <p className="text-sm text-slate-500 mt-1">
          Manage your preferences and notifications
        </p>
      </div>
      <SettingsForm initialSettings={settings} />
    </div>
  );
};

export default SettingsPage;
