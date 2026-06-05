import { Receipt } from "lucide-react";

import { ProtectedPage } from "@/components/shared/ProtectedPage";
import { EmptyModulePage } from "@/modules/EmptyModulePage";

export default function SubscriptionsPage() {
  return (
    <ProtectedPage allowedRoles={["SUPER_ADMIN", "ADMIN"]}>
      <EmptyModulePage
        title="Subscriptions"
        description="Track active subscribers and billing status."
        icon={Receipt}
      />
    </ProtectedPage>
  );
}
