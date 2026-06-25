import { ProtectedPage } from '@/components/shared/ProtectedPage';
import UsersTable from '@/components/users/UsersTable';

export default function UsersPage() {
  return (
    <ProtectedPage allowedRoles={['SUPER_ADMIN', 'ADMIN']}>
      <UsersTable />
    </ProtectedPage>
  );
}
