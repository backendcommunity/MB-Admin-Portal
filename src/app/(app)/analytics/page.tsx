import { ProtectedPage } from "@/components/shared/ProtectedPage";
import AnalyticsDashboard from "@/components/analytics/AnalyticsDashboard";

export const metadata = {
  title: "Analytics | MB Admin Portal",
  description: "Monitor user growth, revenue, and engagement across the platform.",
};

export default function AnalyticsPage() {
  return (
    <ProtectedPage allowedRoles={["SUPER_ADMIN", "ADMIN"]}>
      <section className="flex flex-col gap-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold text-foreground">Analytics</h1>
          <p className="text-sm text-muted-foreground">
            Monitor user growth, revenue, and engagement across the platform.
          </p>
        </header>
        <AnalyticsDashboard />
      </section>
    </ProtectedPage>
  );
}
