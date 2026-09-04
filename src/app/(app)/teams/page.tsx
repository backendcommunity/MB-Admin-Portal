import { ProtectedPage } from '@/components/shared/ProtectedPage';
import { TeamsTable } from '@/components/teams/TeamsTable';

export default function TeamsPage() {
  return (
    <ProtectedPage allowedRoles={['SUPER_ADMIN', 'ADMIN']}>
      <TeamsTable />
    </ProtectedPage>
  );
}
