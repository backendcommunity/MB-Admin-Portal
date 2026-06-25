import { ProtectedPage } from "@/components/shared/ProtectedPage";
import BootcampsTable from "@/components/bootcamps/BootcampsTable";

export default function BootcampsPage() {
  return (
    <ProtectedPage allowedRoles={["SUPER_ADMIN", "ADMIN"]}>
      <div className="p-6">
        <h1 className="text-2xl font-semibold mb-4">Bootcamps</h1>
        <BootcampsTable />
      </div>
    </ProtectedPage>
  );
}
