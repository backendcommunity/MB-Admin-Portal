import { ProtectedPage } from '@/components/shared/ProtectedPage';
import CohortDetailClient from '@/components/bootcamps/CohortDetailClient';

export default function CohortDetailPage() {
  return (
    <ProtectedPage allowedRoles={['SUPER_ADMIN', 'ADMIN', 'INSTRUCTOR']}>
      <CohortDetailClient />
    </ProtectedPage>
  );
}
