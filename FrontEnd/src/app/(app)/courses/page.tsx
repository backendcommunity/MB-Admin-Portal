import { BookOpen } from "lucide-react";

import { ProtectedPage } from "@/components/shared/ProtectedPage";
import CoursesTable from "@/components/courses/CoursesTable";

export default function CoursesPage() {
  return (
    <ProtectedPage allowedRoles={["SUPER_ADMIN", "ADMIN"]}>
      <div className="p-6">
        <h1 className="text-2xl font-semibold mb-4">Courses</h1>
        <CoursesTable />
      </div>
    </ProtectedPage>
  );
}
