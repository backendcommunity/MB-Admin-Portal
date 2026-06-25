import { ProtectedPage } from '@/components/shared/ProtectedPage';
import CoursesTable from '@/components/courses/CoursesTable';

export default function CoursesPage() {
  return (
    <ProtectedPage allowedRoles={['SUPER_ADMIN', 'ADMIN']}>
      <CoursesTable />
    </ProtectedPage>
  );
}
