import { ProtectedPage } from '@/components/shared/ProtectedPage';
import TemplateDetailClient from '@/components/mock-interviews/TemplateDetailClient';

export default function MockInterviewDetailPage() {
  return (
    <ProtectedPage allowedRoles={['SUPER_ADMIN', 'ADMIN', 'INSTRUCTOR']}>
      <TemplateDetailClient />
    </ProtectedPage>
  );
}
