import { ProtectedPage } from "@/components/shared/ProtectedPage";
import SubscriptionsPanel from "@/components/subscriptions/SubscriptionsPanel";

export default function SubscriptionsPage() {
  return (
    <ProtectedPage allowedRoles={["SUPER_ADMIN", "ADMIN"]}>
      <section className="flex flex-col gap-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold text-foreground">Subscriptions</h1>
          <p className="text-sm text-muted-foreground">
            Track active subscribers, transactions, and manual grants.
          </p>
        </header>
        <SubscriptionsPanel />
      </section>
    </ProtectedPage>
  );
}
