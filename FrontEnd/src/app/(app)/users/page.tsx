import { Users } from "lucide-react";

import { ProtectedPage } from "@/components/shared/ProtectedPage";
import { EmptyModulePage } from "@/modules/EmptyModulePage";

export default function UsersPage() {
  return (
    <ProtectedPage allowedRoles={["SUPER_ADMIN", "ADMIN"]}>
      <EmptyModulePage
        title="Users"
        description="Manage users, roles, and access controls."
        icon={Users}
      />
    </ProtectedPage>
  );
}
