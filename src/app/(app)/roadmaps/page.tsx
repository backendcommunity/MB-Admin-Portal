import { ProtectedPage } from '@/components/shared/ProtectedPage';
import RoadmapsTable from '@/components/roadmaps/RoadmapsTable';

export default function RoadmapsPage() {
  return (
    <ProtectedPage allowedRoles={['SUPER_ADMIN', 'ADMIN']}>
      <RoadmapsTable />
    </ProtectedPage>
  );
}
