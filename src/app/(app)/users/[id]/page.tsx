import { ProtectedPage } from '@/components/shared/ProtectedPage';
import UserDetailClient from '@/components/users/UserDetailClient';

export default function UserDetailPage() {
  return (
    <ProtectedPage allowedRoles={['SUPER_ADMIN', 'ADMIN']}>
      <UserDetailClient />
    </ProtectedPage>
  );
}
