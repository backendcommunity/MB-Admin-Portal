import { ProtectedPage } from '@/components/shared/ProtectedPage';
import BootcampDetailClient from '@/components/bootcamps/BootcampDetailClient';

export default function BootcampDetailPage() {
  return (
    <ProtectedPage allowedRoles={['SUPER_ADMIN', 'ADMIN']}>
      <BootcampDetailClient />
    </ProtectedPage>
  );
}
