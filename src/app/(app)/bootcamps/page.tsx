import { ProtectedPage } from '@/components/shared/ProtectedPage';
import BootcampsTable from '@/components/bootcamps/BootcampsTable';

export default function BootcampsPage() {
  return (
    <ProtectedPage allowedRoles={['SUPER_ADMIN', 'ADMIN']}>
      <BootcampsTable />
    </ProtectedPage>
  );
}
