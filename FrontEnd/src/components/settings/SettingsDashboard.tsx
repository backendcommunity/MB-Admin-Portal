"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Save, AlertCircle, RefreshCcw } from "lucide-react";

import { getSettings, updateSettings } from "@/lib/api/settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function SettingsDashboard() {
  const queryClient = useQueryClient();
  
  const [localSettings, setLocalSettings] = useState<Record<string, any>>({});
  const [hasChanges, setHasChanges] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["settings"],
    queryFn: getSettings,
  });

  useEffect(() => {
    if (data) {
      setLocalSettings({
        MAINTENANCE_MODE: data.MAINTENANCE_MODE?.value === "true" || data.MAINTENANCE_MODE?.value === true,
        SIGNUPS_ENABLED: data.SIGNUPS_ENABLED?.value === "true" || data.SIGNUPS_ENABLED?.value === true,
        GLOBAL_BANNER_ENABLED: data.GLOBAL_BANNER?.value?.enabled || false,
        GLOBAL_BANNER_TEXT: data.GLOBAL_BANNER?.value?.text || "",
      });
      setHasChanges(false);
    }
  }, [data]);

  const mutation = useMutation({
    mutationFn: (updates: Record<string, any>) => updateSettings(updates),
    onSuccess: () => {
      toast.success("Settings updated successfully");
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      setHasChanges(false);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || "Failed to update settings");
    },
  });

  const handleToggle = (key: string, checked: boolean) => {
    setLocalSettings((prev) => ({ ...prev, [key]: checked }));
    setHasChanges(true);
  };

  const handleTextChange = (key: string, value: string) => {
    setLocalSettings((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleSave = () => {
    const updates = {
      MAINTENANCE_MODE: String(localSettings.MAINTENANCE_MODE),
      SIGNUPS_ENABLED: String(localSettings.SIGNUPS_ENABLED),
      GLOBAL_BANNER: {
        enabled: localSettings.GLOBAL_BANNER_ENABLED,
        text: localSettings.GLOBAL_BANNER_TEXT,
      },
    };
    mutation.mutate(updates);
  };

  if (isLoading) {
    return (
      <div className="grid gap-6 md:grid-cols-2">
        <Skeleton className="h-[200px] rounded-xl" />
        <Skeleton className="h-[200px] rounded-xl" />
        <Skeleton className="h-[250px] rounded-xl md:col-span-2" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex h-40 flex-col items-center justify-center rounded-xl border border-dashed text-muted-foreground gap-4">
        <AlertCircle className="h-8 w-8 text-destructive" />
        <p>Failed to load settings.</p>
        <Button variant="outline" onClick={() => refetch()}>Try Again</Button>
      </div>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* Platform Toggles */}
      <Card>
        <CardHeader>
          <CardTitle>Platform Status</CardTitle>
          <CardDescription>Manage core availability and registration rules.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between space-x-4">
            <div className="flex flex-col space-y-1">
              <Label className="text-base font-medium">Maintenance Mode</Label>
              <p className="text-sm text-muted-foreground">
                Disables student access and displays a "We'll be right back" page.
              </p>
            </div>
            <Switch
              checked={localSettings.MAINTENANCE_MODE}
              onCheckedChange={(c) => handleToggle("MAINTENANCE_MODE", c)}
            />
          </div>
          
          <div className="flex items-center justify-between space-x-4">
            <div className="flex flex-col space-y-1">
              <Label className="text-base font-medium">New Signups</Label>
              <p className="text-sm text-muted-foreground">
                Allow new users to register on the platform.
              </p>
            </div>
            <Switch
              checked={localSettings.SIGNUPS_ENABLED}
              onCheckedChange={(c) => handleToggle("SIGNUPS_ENABLED", c)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Announcement Banner */}
      <Card>
        <CardHeader>
          <CardTitle>Global Banner</CardTitle>
          <CardDescription>Display an announcement bar at the top of the app.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between space-x-4">
            <Label className="text-base font-medium">Enable Banner</Label>
            <Switch
              checked={localSettings.GLOBAL_BANNER_ENABLED}
              onCheckedChange={(c) => handleToggle("GLOBAL_BANNER_ENABLED", c)}
            />
          </div>
          <div className="space-y-2">
            <Label>Banner Text</Label>
            <Input
              placeholder="e.g. Black Friday Sale! Use code BF2026"
              value={localSettings.GLOBAL_BANNER_TEXT}
              onChange={(e) => handleTextChange("GLOBAL_BANNER_TEXT", e.target.value)}
              disabled={!localSettings.GLOBAL_BANNER_ENABLED}
            />
          </div>
        </CardContent>
      </Card>

      {/* Save Action */}
      <div className="flex justify-end gap-4 md:col-span-2">
        <Button variant="ghost" onClick={() => refetch()} disabled={!hasChanges || mutation.isPending}>
          Discard Changes
        </Button>
        <Button onClick={handleSave} disabled={!hasChanges || mutation.isPending}>
          {mutation.isPending ? <RefreshCcw className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Save Configuration
        </Button>
      </div>
    </div>
  );
}
