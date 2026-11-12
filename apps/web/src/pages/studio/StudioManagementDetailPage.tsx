import { useParams } from 'react-router-dom';
import { StudioManagementContent } from '@/components/management/StudioManagementContent';
import { useAuth } from '@/hooks/useAuth';
import {
  useMyStudios,
  useStudioSessions,
  useStudioWorkshops,
} from '@/hooks/useManagement';

export function StudioManagementDetailPage() {
  const { studioId = '' } = useParams();
  const { user, isLoading: authLoading, authError, retryAuth } = useAuth();
  const studiosQuery = useMyStudios();
  const studio = studiosQuery.data?.find((item) => item.id === studioId);
  const authorizedStudioId = user && studio ? studio.id : '';
  const workshopsQuery = useStudioWorkshops(authorizedStudioId);
  const sessionsQuery = useStudioSessions(authorizedStudioId);

  return (
    <StudioManagementContent
      user={user}
      authLoading={authLoading}
      authError={authError instanceof Error ? authError : null}
      studiosLoading={studiosQuery.isLoading}
      studiosError={
        studiosQuery.error instanceof Error ? studiosQuery.error : null
      }
      studio={studio}
      retryAuth={() => void retryAuth()}
      retryStudios={() => void studiosQuery.refetch()}
      workshops={workshopsQuery.data}
      workshopsLoading={workshopsQuery.isLoading}
      workshopsError={
        workshopsQuery.error instanceof Error ? workshopsQuery.error : null
      }
      retryWorkshops={() => void workshopsQuery.refetch()}
      sessions={sessionsQuery.data}
      sessionsLoading={sessionsQuery.isLoading}
      sessionsError={
        sessionsQuery.error instanceof Error ? sessionsQuery.error : null
      }
      retrySessions={() => void sessionsQuery.refetch()}
    />
  );
}
