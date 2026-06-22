import { ProtectedPage } from "@/components/shared/ProtectedPage";
import MockInterviewsDashboard from "@/components/mock-interviews/MockInterviewsDashboard";

export const metadata = {
  title: "Mock Interview Templates | MB Admin Portal",
  description: "Manage mock interview templates and questions.",
};

export default function MockInterviewsPage() {
  return (
    <ProtectedPage allowedRoles={["SUPER_ADMIN", "ADMIN", "INSTRUCTOR"]}>
      <section className="flex flex-col gap-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold text-foreground">Mock Interview Templates</h1>
          <p className="text-sm text-muted-foreground">
            Create and edit templates that users can use for practice interviews.
          </p>
        </header>
        <MockInterviewsDashboard />
      </section>
    </ProtectedPage>
  );
}
