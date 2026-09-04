import { ProtectedPage } from '@/components/shared/ProtectedPage';
import { UserImportDetailClient } from '@/components/users/UserImportDetailClient';

export default function UserImportDetailPage() {
  return (
    <ProtectedPage allowedRoles={['SUPER_ADMIN', 'ADMIN']}>
      <UserImportDetailClient />
    </ProtectedPage>
  );
}
