import { ProtectedPage } from '@/components/shared/ProtectedPage';
import ProjectsTable from '@/components/projects/ProjectsTable';

export default function ProjectsPage() {
  return (
    <ProtectedPage allowedRoles={['SUPER_ADMIN', 'ADMIN']}>
      <ProjectsTable />
    </ProtectedPage>
  );
}
