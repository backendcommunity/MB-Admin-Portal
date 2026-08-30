import { ProtectedPage } from '@/components/shared/ProtectedPage';
import ProjectDetailClient from '@/components/projects/ProjectDetailClient';

export default function ProjectDetailPage() {
  return (
    <ProtectedPage allowedRoles={['SUPER_ADMIN', 'ADMIN']}>
      <ProjectDetailClient />
    </ProtectedPage>
  );
}
