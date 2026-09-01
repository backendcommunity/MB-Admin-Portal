import { ProtectedPage } from '@/components/shared/ProtectedPage';
import NewProjectClient from '@/components/projects/NewProjectClient';

export default function NewProjectPage() {
  return (
    <ProtectedPage allowedRoles={['SUPER_ADMIN', 'ADMIN', 'INSTRUCTOR']}>
      <NewProjectClient />
    </ProtectedPage>
  );
}
