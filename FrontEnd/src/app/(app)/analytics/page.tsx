import { BarChart3 } from "lucide-react";

import { ProtectedPage } from "@/components/shared/ProtectedPage";
import { EmptyModulePage } from "@/modules/EmptyModulePage";

export default function AnalyticsPage() {
  return (
    <ProtectedPage allowedRoles={["SUPER_ADMIN", "ADMIN"]}>
      <EmptyModulePage
        title="Analytics"
        description="Monitor growth, revenue, and engagement."
        icon={BarChart3}
      />
    </ProtectedPage>
  );
}
