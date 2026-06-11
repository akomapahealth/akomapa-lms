"use client";

import { useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { type UserSettingsData } from "@/actions/get-user-settings";

interface SettingsFormProps {
  initialSettings: UserSettingsData;
}

export const SettingsForm = ({ initialSettings }: SettingsFormProps) => {
  const [settings, setSettings] = useState(initialSettings);
  const [isSaving, setIsSaving] = useState(false);

  const onSave = async () => {
    setIsSaving(true);
    try {
      await axios.patch("/api/settings", settings);
      toast.success("Settings saved");
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setIsSaving(false);
    }
  };

  const updateSetting = <K extends keyof UserSettingsData>(
    key: K,
    value: UserSettingsData[K]
  ) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="space-y-6">
      {/* Appearance */}
      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="text-lg">Appearance</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Theme</Label>
              <p className="text-sm text-slate-500">
                Choose your preferred color scheme
              </p>
            </div>
            <Select
              value={settings.theme}
              onValueChange={(value) => updateSetting("theme", value)}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light">Light</SelectItem>
                <SelectItem value="dark">Dark</SelectItem>
                <SelectItem value="system">System</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Privacy */}
      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="text-lg">Privacy</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Default Journal Privacy</Label>
              <p className="text-sm text-slate-500">
                New journal entries are private by default
              </p>
            </div>
            <Switch
              checked={settings.defaultJournalPrivacy}
              onCheckedChange={(checked) =>
                updateSetting("defaultJournalPrivacy", checked)
              }
            />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <Label>Show Profile in Community</Label>
              <p className="text-sm text-slate-500">
                Allow other students to see your profile
              </p>
            </div>
            <Switch
              checked={settings.showProfileInCommunity}
              onCheckedChange={(checked) =>
                updateSetting("showProfileInCommunity", checked)
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="text-lg">Email Notifications</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Badge Earned</Label>
              <p className="text-sm text-slate-500">
                Get notified when you earn a new badge
              </p>
            </div>
            <Switch
              checked={settings.emailOnBadgeEarned}
              onCheckedChange={(checked) =>
                updateSetting("emailOnBadgeEarned", checked)
              }
            />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <Label>Forum Replies</Label>
              <p className="text-sm text-slate-500">
                Get notified when someone replies to your post
              </p>
            </div>
            <Switch
              checked={settings.emailOnForumReply}
              onCheckedChange={(checked) =>
                updateSetting("emailOnForumReply", checked)
              }
            />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <Label>Faculty Comments</Label>
              <p className="text-sm text-slate-500">
                Get notified when faculty comments on your work
              </p>
            </div>
            <Switch
              checked={settings.emailOnFacultyComment}
              onCheckedChange={(checked) =>
                updateSetting("emailOnFacultyComment", checked)
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* Profile */}
      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="text-lg">Profile</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-500">
            Your profile information is managed through your account provider.
          </p>
          <Button variant="outline" size="sm" className="mt-3" asChild>
            <a
              href="https://accounts.clerk.dev/user"
              target="_blank"
              rel="noopener noreferrer"
            >
              Manage Profile
            </a>
          </Button>
        </CardContent>
      </Card>

      {/* Save */}
      <div className="flex justify-end">
        <Button onClick={onSave} disabled={isSaving}>
          {isSaving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            "Save Changes"
          )}
        </Button>
      </div>
    </div>
  );
};
