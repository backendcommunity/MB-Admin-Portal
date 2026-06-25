import { ProtectedPage } from "@/components/shared/ProtectedPage";
import ProjectsTable from "@/components/projects/ProjectsTable";

export default function ProjectsPage() {
  return (
    <ProtectedPage allowedRoles={["SUPER_ADMIN", "ADMIN"]}>
      <section className="flex flex-col gap-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold text-foreground">Projects</h1>
          <p className="text-sm text-muted-foreground">
            Manage projects, status, and submissions.
          </p>
        </header>
        <ProjectsTable />
      </section>
    </ProtectedPage>
  );
}
