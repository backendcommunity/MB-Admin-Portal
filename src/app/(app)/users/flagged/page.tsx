import { ProtectedPage } from '@/components/shared/ProtectedPage';
import FlaggedUsers from '@/components/users/FlaggedUsers';

export default function FlaggedUsersPage() {
  return (
    <ProtectedPage allowedRoles={['SUPER_ADMIN', 'ADMIN']}>
      <FlaggedUsers />
    </ProtectedPage>
  );
}
