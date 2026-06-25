import { ProtectedPage } from '@/components/shared/ProtectedPage';
import AuditLogsTable from '@/components/audit/AuditLogsTable';

export const metadata = {
  title: 'Audit Logs | MB Admin Portal',
  description: 'View an immutable record of all administrative actions.',
};

export default function AuditLogsPage() {
  return (
    <ProtectedPage allowedRoles={['SUPER_ADMIN', 'ADMIN']}>
      <AuditLogsTable />
    </ProtectedPage>
  );
}
