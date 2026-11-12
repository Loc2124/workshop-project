import { StudioOverview } from '../../components/management/StudioOverview';
import { useAuth } from '../../hooks/useAuth';
import { useMyStudios } from '../../hooks/useManagement';

export function StudioManagementPage() {
  const { user, isLoading: authLoading, authError, retryAuth } = useAuth();
  const studiosQuery = useMyStudios();

  return (
    <StudioOverview
      user={user}
      authLoading={authLoading}
      authError={authError instanceof Error ? authError : null}
      retryAuth={() => void retryAuth()}
      studios={studiosQuery.data?.filter((studio) => studio.role === 'owner')}
      studiosLoading={studiosQuery.isLoading}
      studiosError={
        studiosQuery.error instanceof Error ? studiosQuery.error : null
      }
      retryStudios={() => void studiosQuery.refetch()}
    />
  );
}
