import { ProtectedPage } from "@/components/shared/ProtectedPage";
import EarningsPanel from "@/components/instructor/EarningsPanel";

export default function EarningsPage() {
  return (
    <ProtectedPage allowedRoles={["INSTRUCTOR"]}>
      <section className="flex flex-col gap-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold text-foreground">Earnings</h1>
          <p className="text-sm text-muted-foreground">
            Review total revenue, pending payout, and payout history.
          </p>
        </header>
        <EarningsPanel />
      </section>
    </ProtectedPage>
  );
}
