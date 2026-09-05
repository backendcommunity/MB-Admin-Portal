import { ProtectedPage } from '@/components/shared/ProtectedPage';
import NewTemplateClient from '@/components/mock-interviews/NewTemplateClient';

export default function NewMockInterviewPage() {
  return (
    <ProtectedPage allowedRoles={['SUPER_ADMIN', 'ADMIN', 'INSTRUCTOR']}>
      <NewTemplateClient />
    </ProtectedPage>
  );
}
