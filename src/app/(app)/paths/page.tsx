import { ProtectedPage } from '@/components/shared/ProtectedPage';
import PathsTable from '@/components/paths/PathsTable';

export default function PathsPage() {
  return (
    <ProtectedPage allowedRoles={['SUPER_ADMIN', 'ADMIN']}>
      <PathsTable />
    </ProtectedPage>
  );
}
