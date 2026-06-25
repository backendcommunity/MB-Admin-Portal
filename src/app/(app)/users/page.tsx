import { Users } from "lucide-react";

import { ProtectedPage } from "@/components/shared/ProtectedPage";
import UsersTable from "@/components/users/UsersTable";

export default function UsersPage() {
  return (
    <ProtectedPage allowedRoles={["SUPER_ADMIN", "ADMIN"]}>
      <div className="p-6">
        <h1 className="text-2xl font-semibold mb-4">Users</h1>
        <UsersTable />
      </div>
    </ProtectedPage>
  );
}
