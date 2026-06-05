import { BookOpen } from "lucide-react";

import { ProtectedPage } from "@/components/shared/ProtectedPage";
import { EmptyModulePage } from "@/modules/EmptyModulePage";

export default function CoursesPage() {
  return (
    <ProtectedPage allowedRoles={["SUPER_ADMIN", "ADMIN"]}>
      <EmptyModulePage
        title="Courses"
        description="Create, edit, and publish courses."
        icon={BookOpen}
      />
    </ProtectedPage>
  );
}
