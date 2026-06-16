import { ProtectedPage } from "@/components/shared/ProtectedPage";
import MyContentPanel from "@/components/instructor/MyContentPanel";

export default function MyContentPage() {
  return (
    <ProtectedPage allowedRoles={["INSTRUCTOR"]}>
      <section className="flex flex-col gap-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold text-foreground">My Content</h1>
          <p className="text-sm text-muted-foreground">
            Track your courses, projects, and roadmaps, then submit updates for review.
          </p>
        </header>
        <MyContentPanel />
      </section>
    </ProtectedPage>
  );
}
