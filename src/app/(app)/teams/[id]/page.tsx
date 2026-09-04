import { ProtectedPage } from '@/components/shared/ProtectedPage';
import { TeamDetailClient } from '@/components/teams/TeamDetailClient';

export default function TeamDetailPage() {
  return (
    <ProtectedPage allowedRoles={['SUPER_ADMIN', 'ADMIN']}>
      <TeamDetailClient />
    </ProtectedPage>
  );
}
