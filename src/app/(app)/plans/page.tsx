import { ProtectedPage } from '@/components/shared/ProtectedPage';
import PlansTable from '@/components/plans/PlansTable';

export default function PlansPage() {
  return (
    <ProtectedPage allowedRoles={['SUPER_ADMIN', 'ADMIN']}>
      <PlansTable />
    </ProtectedPage>
  );
}
