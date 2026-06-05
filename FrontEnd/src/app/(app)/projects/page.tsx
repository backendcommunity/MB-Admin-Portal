import { FolderKanban } from "lucide-react";

import { ProtectedPage } from "@/components/shared/ProtectedPage";
import { EmptyModulePage } from "@/modules/EmptyModulePage";

export default function ProjectsPage() {
  return (
    <ProtectedPage allowedRoles={["SUPER_ADMIN", "ADMIN"]}>
      <EmptyModulePage
        title="Projects"
        description="Review and manage learning projects."
        icon={FolderKanban}
      />
    </ProtectedPage>
  );
}
