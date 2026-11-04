import { StudioBookingManager } from '../components/management/StudioBookingManager';
import { LoadingState } from '../components/ui/LoadingState';
import { StudioNotifications } from '../components/management/StudioNotifications';
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom';
import {
  useMyStudios,
  useStudioWorkshops,
  useStudioSessions,
} from '../hooks/useManagement';
import { StudioWorkshopManager } from '../components/management/StudioWorkshopManager';
import { StudioSessionManager } from '../components/management/StudioSessionManager';
import { StudioEvidenceEditor } from '../components/management/StudioEvidenceEditor';
import { StudioTrustBadge } from '../components/ui/StudioTrustBadge';
import { Button } from '../components/ui/button';
import { studioApplicationStatus } from '../lib/studio-application-status';

type Section = 'workshops' | 'sessions' | 'bookings' | 'profile';
const titles: Record<Section, string> = {
  workshops: 'Workshop',
  sessions: 'Lịch và slot',
  bookings: 'Đặt chỗ',
  profile: 'Hồ sơ studio',
};
export function StudioWorkspacePage({ section }: { section: Section }) {
  const [search] = useSearchParams();
  const { studioId } = useParams();
  const studiosQuery = useMyStudios();
  const studios =
    studiosQuery.data?.filter((studio) => studio.role === 'owner') ?? [];
  const requested = studioId ?? search.get('studioId');
  const studio = requested
    ? studios.find((item) => item.id === requested)
    : studios[0];
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
    ['sessions', 'bookings'].includes(section)
  )
    return <Navigate to={`/studio/${studio.id}`} replace />;
  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-4">
        <div>
          <h1 className="font-heading text-2xl font-semibold">
            {titles[section]}
          </h1>
          <p className="mt-1 text-sm text-muted">
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
          {section === 'profile' && (
            <>
              {studio.rejectionReason &&
                ['needs_changes', 'rejected', 'suspended'].includes(
                  studio.status,
                ) && (
                  <section className="rounded-md border border-amber-200 bg-amber-50 p-4">
                    <h2 className="font-heading text-lg font-semibold">
                      {studio.status === 'suspended'
                        ? 'Lý do tạm ngưng'
                        : studio.status === 'needs_changes'
                          ? 'Nội dung cần bổ sung'
                          : 'Lý do từ chối'}
                    </h2>
                    <p className="mt-2 whitespace-pre-wrap text-sm text-amber-900">
                      {studio.rejectionReason}
                    </p>
                  </section>
                )}
              <section className="rounded-md border border-line bg-surface p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="font-heading text-lg font-semibold">
                    {studio.name}
                  </h2>
                  <span className="text-xs text-muted">
                    {studioApplicationStatus[studio.status].label}
                  </span>
                </div>
                <StudioTrustBadge level={studio.trustLevel} explain />
                <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-xs text-muted">Địa chỉ</dt>
                    <dd className="mt-1">{studio.address}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted">Tỉnh / thành phố</dt>
                    <dd className="mt-1">
                      {studio.province ?? 'Chưa bổ sung'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted">Số điện thoại</dt>
                    <dd className="mt-1">
                      {studio.contactPhone || 'Chưa bổ sung'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted">Email liên hệ</dt>
                    <dd className="mt-1 break-all">
                      {studio.contactEmail || 'Chưa bổ sung'}
                    </dd>
                  </div>
                </dl>
                {studio.status === 'approved' && studio.profileComplete && (
                  <Link
                    to={`/studios/${studio.slug}`}
                    className="mt-3 inline-flex min-h-11 items-center font-semibold text-primary underline"
                  >
                    Xem trang studio công khai
                  </Link>
                )}
              </section>
              {studio.status !== 'suspended' && (
                <StudioEvidenceEditor key={studio.id} studio={studio} />
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
