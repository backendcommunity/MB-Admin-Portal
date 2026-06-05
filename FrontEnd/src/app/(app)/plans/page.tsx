import { CreditCard } from "lucide-react";

import { ProtectedPage } from "@/components/shared/ProtectedPage";
import { EmptyModulePage } from "@/modules/EmptyModulePage";

export default function PlansPage() {
  return (
    <ProtectedPage allowedRoles={["SUPER_ADMIN", "ADMIN"]}>
      <EmptyModulePage
        title="Plans"
        description="Create and manage subscription plans."
        icon={CreditCard}
      />
    </ProtectedPage>
  );
}
