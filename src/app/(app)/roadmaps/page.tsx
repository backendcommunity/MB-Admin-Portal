import { ProtectedPage } from "@/components/shared/ProtectedPage";
import RoadmapsTable from "@/components/roadmaps/RoadmapsTable";

export default function RoadmapsPage() {
  return (
    <ProtectedPage allowedRoles={["SUPER_ADMIN", "ADMIN"]}>
      <section className="flex flex-col gap-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold text-foreground">Roadmaps</h1>
          <p className="text-sm text-muted-foreground">
            Manage roadmaps, topics, and topic-course links.
          </p>
        </header>
        <RoadmapsTable />
      </section>
    </ProtectedPage>
  );
}
