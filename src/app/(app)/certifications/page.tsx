import { ProtectedPage } from '@/components/shared/ProtectedPage';
import { CertificateImportsTable } from '@/components/certifications/CertificateImportsTable';

export default function CertificationsPage() {
  return (
    <ProtectedPage allowedRoles={['SUPER_ADMIN', 'ADMIN']}>
      <CertificateImportsTable />
    </ProtectedPage>
  );
}
