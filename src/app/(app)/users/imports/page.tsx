import { ProtectedPage } from '@/components/shared/ProtectedPage';
import { UserImportsTable } from '@/components/users/UserImportsTable';

export default function UserImportsPage() {
  return (
    <ProtectedPage allowedRoles={['SUPER_ADMIN', 'ADMIN']}>
      <UserImportsTable />
    </ProtectedPage>
  );
}
