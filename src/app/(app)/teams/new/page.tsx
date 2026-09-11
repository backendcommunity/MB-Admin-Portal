import { ProtectedPage } from '@/components/shared/ProtectedPage';
import NewTeamClient from '@/components/teams/NewTeamClient';

export default function NewTeamPage() {
  return (
    <ProtectedPage allowedRoles={['SUPER_ADMIN', 'ADMIN']}>
      <NewTeamClient />
    </ProtectedPage>
  );
}
