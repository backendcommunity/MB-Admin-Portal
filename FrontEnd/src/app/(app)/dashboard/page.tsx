import { LayoutDashboard } from "lucide-react";

import { ProtectedPage } from "@/components/shared/ProtectedPage";
import { EmptyModulePage } from "@/modules/EmptyModulePage";

export default function DashboardPage() {
  return (
    <ProtectedPage allowedRoles={["SUPER_ADMIN", "ADMIN", "INSTRUCTOR"]}>
      <EmptyModulePage
        title="Dashboard"
        description="Overview of platform activity and key KPIs."
        icon={LayoutDashboard}
      />
    </ProtectedPage>
  );
}
