import { CheckCircle2 } from "lucide-react";

import { ProtectedPage } from "@/components/shared/ProtectedPage";
import { EmptyModulePage } from "@/modules/EmptyModulePage";

export default function ApprovalsPage() {
  return (
    <ProtectedPage allowedRoles={["SUPER_ADMIN", "ADMIN"]}>
      <EmptyModulePage
        title="Approvals"
        description="Review pending content submissions."
        icon={CheckCircle2}
      />
    </ProtectedPage>
  );
}
