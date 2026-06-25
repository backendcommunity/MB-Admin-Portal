import { ProtectedPage } from "@/components/shared/ProtectedPage";
import PlansTable from "@/components/plans/PlansTable";

export default function PlansPage() {
  return (
    <ProtectedPage allowedRoles={["SUPER_ADMIN", "ADMIN"]}>
      <section className="flex flex-col gap-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold text-foreground">Plans</h1>
          <p className="text-sm text-muted-foreground">
            Create and manage subscription plans.
          </p>
        </header>
        <PlansTable />
      </section>
    </ProtectedPage>
  );
}
