import { GraduationCap } from "lucide-react";

import { ProtectedPage } from "@/components/shared/ProtectedPage";
import { EmptyModulePage } from "@/modules/EmptyModulePage";

export default function BootcampsPage() {
  return (
    <ProtectedPage allowedRoles={["SUPER_ADMIN", "ADMIN"]}>
      <EmptyModulePage
        title="Bootcamps"
        description="Manage bootcamps, cohorts, and schedules."
        icon={GraduationCap}
      />
    </ProtectedPage>
  );
}
