import { ProtectedPage } from "@/components/shared/ProtectedPage";
import AuditLogsTable from "@/components/audit/AuditLogsTable";

export const metadata = {
  title: "Audit Logs | MB Admin Portal",
  description: "View an immutable record of all administrative actions.",
};

export default function AuditLogsPage() {
  return (
    <ProtectedPage allowedRoles={["SUPER_ADMIN", "ADMIN"]}>
      <section className="flex flex-col gap-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold text-foreground">Audit Logs</h1>
          <p className="text-sm text-muted-foreground">
            Immutable record of all administrative actions across the platform.
          </p>
        </header>
        <AuditLogsTable />
      </section>
    </ProtectedPage>
  );
}
