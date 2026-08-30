import { ProtectedPage } from '@/components/shared/ProtectedPage';
import AssignmentsQueue from '@/components/bootcamps/AssignmentsQueue';

export default function AssignmentsPage() {
  return (
    <ProtectedPage allowedRoles={['SUPER_ADMIN', 'ADMIN']}>
      <AssignmentsQueue />
    </ProtectedPage>
  );
}
