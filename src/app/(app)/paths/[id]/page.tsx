import { ProtectedPage } from '@/components/shared/ProtectedPage';
import PathDetailClient from '@/components/paths/PathDetailClient';

export default function PathDetailPage() {
  return (
    <ProtectedPage allowedRoles={['SUPER_ADMIN', 'ADMIN']}>
      <PathDetailClient />
    </ProtectedPage>
  );
}
