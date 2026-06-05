import { Wallet } from "lucide-react";

import { ProtectedPage } from "@/components/shared/ProtectedPage";
import { EmptyModulePage } from "@/modules/EmptyModulePage";

export default function EarningsPage() {
  return (
    <ProtectedPage allowedRoles={["INSTRUCTOR"]}>
      <EmptyModulePage
        title="Earnings"
        description="Review payouts and revenue share details."
        icon={Wallet}
      />
    </ProtectedPage>
  );
}
