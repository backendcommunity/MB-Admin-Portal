import { ProtectedPage } from '@/components/shared/ProtectedPage';
import MockInterviewsTable from '@/components/mock-interviews/MockInterviewsTable';

export const metadata = {
  title: 'Mock Interviews | MB Admin Portal',
  description: 'Templates a learner practises against.',
};

export default function MockInterviewsPage() {
  return (
    <ProtectedPage allowedRoles={['SUPER_ADMIN', 'ADMIN', 'INSTRUCTOR']}>
      <MockInterviewsTable />
    </ProtectedPage>
  );
}
