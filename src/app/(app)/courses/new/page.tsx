import { ProtectedPage } from '@/components/shared/ProtectedPage';
import NewCourseClient from '@/components/courses/NewCourseClient';

export default function NewCoursePage() {
  return (
    <ProtectedPage allowedRoles={['SUPER_ADMIN', 'ADMIN']}>
      <NewCourseClient />
    </ProtectedPage>
  );
}
