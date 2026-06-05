import { Map } from "lucide-react";

import { ProtectedPage } from "@/components/shared/ProtectedPage";
import { EmptyModulePage } from "@/modules/EmptyModulePage";

export default function RoadmapsPage() {
  return (
    <ProtectedPage allowedRoles={["SUPER_ADMIN", "ADMIN"]}>
      <EmptyModulePage
        title="Roadmaps"
        description="Plan learning journeys and linked courses."
        icon={Map}
      />
    </ProtectedPage>
  );
}
