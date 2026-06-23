"use client";

import { LayoutDashboard } from "lucide-react";
import { ProtectedPage } from "@/components/shared/ProtectedPage";
import { EmptyModulePage } from "@/modules/EmptyModulePage";
import AnalyticsDashboard from "@/components/analytics/AnalyticsDashboard";
import { useAuthStore } from "@/store/authStore";

export default function DashboardPage() {
  const role = useAuthStore((state) => state.userRole);
  const isAdmin = role === "ADMIN" || role === "SUPER_ADMIN";

  return (
    <ProtectedPage allowedRoles={["SUPER_ADMIN", "ADMIN", "INSTRUCTOR"]}>
      {isAdmin ? (
        <section className="flex flex-col gap-6">
          <header className="space-y-1">
            <h1 className="text-2xl font-semibold text-foreground">Dashboard</h1>
            <p className="text-sm text-muted-foreground">
              Overview of platform activity and key KPIs.
            </p>
          </header>
          <AnalyticsDashboard />
        </section>
      ) : (
        <EmptyModulePage
          title="Dashboard"
          description="Overview of your course activity and student progress will appear here."
          icon={LayoutDashboard}
        />
      )}
    </ProtectedPage>
  );
}
