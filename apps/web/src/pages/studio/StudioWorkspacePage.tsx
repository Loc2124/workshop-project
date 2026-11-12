import { lazy } from 'react';
import { LoadingState } from '../../components/ui/LoadingState';
import { StudioNotifications } from '../../components/management/StudioNotifications';
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom';
import {
  useMyStudios,
  useStudioWorkshops,
  useStudioSessions,
} from '../../hooks/useManagement';
import { Button } from '../../components/ui/button';
import {
  readActiveStudioId,
  selectDefaultStudio,
} from '../../lib/studio-dashboard';
import { useAuth } from '../../hooks/useAuth';

const StudioWorkshopManager = lazy(() =>
  import('../../components/management/StudioWorkshopManager').then(
    (module) => ({
      default: module.StudioWorkshopManager,
    }),
  ),
);
const StudioSessionManager = lazy(() =>
  import('../../components/management/StudioSessionManager').then((module) => ({
    default: module.StudioSessionManager,
  })),
);
const StudioBookingManager = lazy(() =>
  import('../../components/management/StudioBookingManager').then((module) => ({
    default: module.StudioBookingManager,
  })),
);
const StudioProfileManager = lazy(() =>
  import('../../components/management/StudioProfileManager').then((module) => ({
    default: module.StudioProfileManager,
  })),
);
const StudioMembersManager = lazy(() =>
  import('../../components/management/StudioMembersManager').then((module) => ({
    default: module.StudioMembersManager,
  })),
);
const StudioFinancesManager = lazy(() =>
  import('../../components/management/StudioFinancesManager').then(
    (module) => ({
      default: module.StudioFinancesManager,
    }),
  ),
);

type Section =
  'workshops' | 'sessions' | 'bookings' | 'finances' | 'profile' | 'members';
const titles: Record<Section, string> = {
  workshops: 'Workshop',
  sessions: 'Lịch buổi học',
  bookings: 'Đặt chỗ',
  finances: 'Doanh thu & Quyết toán',
  profile: 'Hồ sơ studio',
  members: 'Quản lý thành viên',
};
export function StudioWorkspacePage({ section }: { section: Section }) {
  const { user } = useAuth();
  const [search] = useSearchParams();
  const { studioId } = useParams();
  const studiosQuery = useMyStudios();
  const studios = studiosQuery.data ?? [];
  const requested = studioId ?? search.get('studioId');
  const studio = requested
    ? studios.find((item) => item.id === requested)
    : selectDefaultStudio(studios, null, section, readActiveStudioId(user?.id));
  const workshopId =
    !studio?.isDraft && (section === 'workshops' || section === 'sessions')
      ? (studio?.id ?? '')
      : '';
  const workshops = useStudioWorkshops(workshopId);
  const sessions = useStudioSessions(
    section === 'sessions' && studio?.status === 'approved' && !studio.isDraft
      ? studio.id
      : '',
  );
  if (
    studiosQuery.isPending ||
    (workshopId && workshops.isPending) ||
    (section === 'sessions' &&
      studio?.status === 'approved' &&
      sessions.isPending)
  ) {
    return <LoadingState label="Đang tải thông tin studio…" variant="page" />;
  }
  if (studio?.isDraft)
    return (
      <Navigate
        to={
          section === 'profile'
            ? `/dang-ky-studio?draftStudioId=${studio.id}`
            : `/studio/${studio.id}`
        }
        replace
      />
    );
  if (
    studio &&
    studio.status !== 'approved' &&
    ['sessions', 'bookings', 'finances', 'members'].includes(section)
  )
    return <Navigate to={`/studio/${studio.id}`} replace />;
  if (
    studio &&
    studio.role !== 'owner' &&
    ['profile', 'members', 'finances'].includes(section)
  )
    return <Navigate to={`/studio/${studio.id}`} replace />;
  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-studio-border pb-4">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight text-studio-ink sm:text-3xl">
            {titles[section]}
          </h1>
          <p className="mt-1 text-sm text-studio-muted">
            {studio?.name ?? 'Chọn studio để tiếp tục quản lý.'}
          </p>
        </div>
      </header>
      {studio && <StudioNotifications studioId={studio.id} />}
      {studiosQuery.error ? (
        <div className="space-y-3">
          <p role="alert">Chưa tải được danh sách studio.</p>
          <Button variant="outline" onClick={() => void studiosQuery.refetch()}>
            Thử lại
          </Button>
        </div>
      ) : !studio ? (
        <div className="space-y-3">
          <p role="alert">Studio này không nằm trong danh sách bạn sở hữu.</p>
          <Button asChild variant="outline">
            <Link to="/studio">Về tổng quan</Link>
          </Button>
        </div>
      ) : (
        <>
          {section === 'workshops' && (
            <StudioWorkshopManager
              studio={studio}
              workshops={workshops.data}
              isLoading={workshops.isLoading}
              error={workshops.error instanceof Error ? workshops.error : null}
              onRetry={() => void workshops.refetch()}
            />
          )}
          {section === 'sessions' && (
            <>
              {workshops.error ? (
                <p role="alert">
                  Chưa tải được workshop.{' '}
                  <button
                    className="underline"
                    onClick={() => void workshops.refetch()}
                  >
                    Thử lại
                  </button>
                </p>
              ) : (
                <StudioSessionManager
                  studio={studio}
                  workshops={workshops.data}
                  sessions={sessions.data}
                  isLoading={sessions.isLoading || workshops.isLoading}
                  error={
                    sessions.error instanceof Error ? sessions.error : null
                  }
                  onRetry={() => {
                    void sessions.refetch();
                    void workshops.refetch();
                  }}
                />
              )}
            </>
          )}
          {section === 'bookings' && (
            <StudioBookingManager studioId={studio.id} />
          )}
          {section === 'finances' && <StudioFinancesManager studio={studio} />}
          {section === 'members' && <StudioMembersManager studio={studio} />}
          {section === 'profile' && <StudioProfileManager studio={studio} />}
        </>
      )}
    </div>
  );
}
