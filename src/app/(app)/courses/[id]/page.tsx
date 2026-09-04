import { ProtectedPage } from '@/components/shared/ProtectedPage';
import CourseDetailClient from '@/components/courses/CourseDetailClient';

export default function CourseDetailPage() {
  return (
    <ProtectedPage allowedRoles={['SUPER_ADMIN', 'ADMIN', 'INSTRUCTOR']}>
      <CourseDetailClient />
    </ProtectedPage>
  );
}
