import { ProtectedPage } from "@/components/shared/ProtectedPage";
import ApprovalsQueue from "@/components/approvals/ApprovalsQueue";

export default function ApprovalsPage() {
  return (
    <ProtectedPage allowedRoles={["SUPER_ADMIN", "ADMIN"]}>
      <section className="flex flex-col gap-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold text-foreground">Approvals</h1>
          <p className="text-sm text-muted-foreground">
            Review pending submissions and take moderation actions.
          </p>
        </header>
        <ApprovalsQueue />
      </section>
    </ProtectedPage>
  );
}
