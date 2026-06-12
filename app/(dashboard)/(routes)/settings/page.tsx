import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { getUserSettings } from "@/actions/get-user-settings";

import { SettingsForm } from "./_components/settings-form";
import { PageContainer } from "@/components/shell/page-container";

const SettingsPage = async () => {
  const { userId } = await auth();

  if (!userId) {
    return redirect("/sign-in");
  }

  const settings = await getUserSettings(userId);

  return (
    <PageContainer width="narrow">
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your preferences and notifications
        </p>
      </div>
      <SettingsForm initialSettings={settings} />
    </PageContainer>
  );
};

export default SettingsPage;
