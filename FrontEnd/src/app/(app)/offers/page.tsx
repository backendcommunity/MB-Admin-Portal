import { ProtectedPage } from "@/components/shared/ProtectedPage";
import OffersDashboard from "@/components/offers/OffersDashboard";

export const metadata = {
  title: "Offers | MB Admin Portal",
  description: "Manage offers and coupons.",
};

export default function OffersPage() {
  return (
    <ProtectedPage allowedRoles={["SUPER_ADMIN", "ADMIN"]}>
      <section className="flex flex-col gap-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold text-foreground">Offers & Coupons</h1>
          <p className="text-sm text-muted-foreground">
            Create, edit, and manage platform promotional offers and pricing plans.
          </p>
        </header>
        <OffersDashboard />
      </section>
    </ProtectedPage>
  );
}
