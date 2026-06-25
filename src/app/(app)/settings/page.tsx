import { ProtectedPage } from "@/components/shared/ProtectedPage";
import SettingsDashboard from "@/components/settings/SettingsDashboard";

export const metadata = {
  title: "Settings | MB Admin Portal",
  description: "Manage global platform settings and configurations.",
};

export default function SettingsPage() {
  return (
    <ProtectedPage allowedRoles={["SUPER_ADMIN", "ADMIN"]}>
      <section className="flex flex-col gap-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold text-foreground">Platform Settings</h1>
          <p className="text-sm text-muted-foreground">
            Manage global platform configurations like maintenance mode and announcement banners.
          </p>
        </header>
        <SettingsDashboard />
      </section>
    </ProtectedPage>
  );
}
