import { FileText } from "lucide-react";

import { ProtectedPage } from "@/components/shared/ProtectedPage";
import { EmptyModulePage } from "@/modules/EmptyModulePage";

export default function MyContentPage() {
  return (
    <ProtectedPage allowedRoles={["INSTRUCTOR"]}>
      <EmptyModulePage
        title="My Content"
        description="Track your courses, projects, and roadmaps."
        icon={FileText}
      />
    </ProtectedPage>
  );
}
