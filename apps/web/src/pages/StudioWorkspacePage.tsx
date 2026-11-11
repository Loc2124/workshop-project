import { lazy } from 'react';
import { StudioPaymentSettings } from '../components/management/StudioPaymentSettings';
import { FinancialAccountForm } from '../components/management/FinancialAccountForm';
import { LoadingState } from '../components/ui/LoadingState';
import { StudioNotifications } from '../components/management/StudioNotifications';
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom';
import {
  useMyStudios,
  useStudioWorkshops,
  useStudioSessions,
} from '../hooks/useManagement';
import { StudioTrustBadge } from '../components/ui/StudioTrustBadge';
import { Img } from '../components/ui/Img';
import { Button } from '../components/ui/button';
import { Images } from 'lucide-react';
import {
  StudioBadge,
  StudioCard,
} from '../components/management/StudioPrimitives';
import { studioApplicationStatus } from '../lib/studio-application-status';

const StudioWorkshopManager = lazy(() =>
  import('../components/management/StudioWorkshopManager').then((module) => ({
    default: module.StudioWorkshopManager,
  })),
);
const StudioSessionManager = lazy(() =>
  import('../components/management/StudioSessionManager').then((module) => ({
    default: module.StudioSessionManager,
  })),
);
const StudioBookingManager = lazy(() =>
  import('../components/management/StudioBookingManager').then((module) => ({
    default: module.StudioBookingManager,
  })),
);
const StudioEvidenceEditor = lazy(() =>
  import('../components/management/StudioEvidenceEditor').then((module) => ({
    default: module.StudioEvidenceEditor,
  })),
);
const StudioMembersManager = lazy(() =>
  import('../components/management/StudioMembersManager').then((module) => ({
    default: module.StudioMembersManager,
  })),
);

type Section = 'workshops' | 'sessions' | 'bookings' | 'profile' | 'members';
const titles: Record<Section, string> = {
  workshops: 'Workshop',
  sessions: 'Lịch buổi học',
  bookings: 'Đặt chỗ',
  profile: 'Hồ sơ studio',
  members: 'Quản lý thành viên',
};
export function StudioWorkspacePage({ section }: { section: Section }) {
  const [search] = useSearchParams();
  const { studioId } = useParams();
  const studiosQuery = useMyStudios();
  const studios = studiosQuery.data ?? [];
  const requested = studioId ?? search.get('studioId');
  const studio = requested
    ? studios.find((item) => item.id === requested)
    : studios[0];
  const coverImage =
    studio?.images?.find((image) => image.id === studio.photoIds?.[0]) ??
    studio?.images?.[0];
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
    ['sessions', 'bookings', 'members'].includes(section)
  )
    return <Navigate to={`/studio/${studio.id}`} replace />;
  if (
    studio &&
    studio.role !== 'owner' &&
    ['profile', 'members'].includes(section)
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
          {section === 'members' && (
            <StudioMembersManager studio={studio} />
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
              <StudioCard className="overflow-hidden p-0">
                <div className="group relative aspect-[16/6] min-h-48 overflow-hidden bg-studio-subtle sm:min-h-64">
                  {coverImage ? (
                    <Img
                      src={coverImage.url}
                      mediumUrl={coverImage.mediumUrl}
                      thumbnailUrl={coverImage.thumbnailUrl}
                      variant="medium"
                      alt={`Ảnh bìa ${studio.name}`}
                      priority
                      sizes="(max-width: 768px) 100vw, 1200px"
                      className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.02] motion-reduce:transition-none"
                    />
                  ) : (
                    <div className="flex size-full flex-col items-center justify-center gap-3 text-studio-muted">
                      <Images aria-hidden="true" className="size-9" />
                      <span className="text-sm">Chưa có ảnh bìa studio</span>
                    </div>
                  )}
                  <div className="absolute inset-x-0 bottom-0 flex flex-wrap items-end justify-between gap-3 bg-gradient-to-t from-studio-ink/80 to-transparent px-5 pb-5 pt-16 sm:px-7 sm:pb-6">
                    <div className="text-white">
                      <p className="text-sm font-medium text-white/85">
                        Không gian sáng tạo
                      </p>
                      <p className="mt-1 font-heading text-2xl font-semibold sm:text-3xl">
                        {studio.name}
                      </p>
                    </div>
                    <StudioBadge
                      tone={
                        studio.status === 'approved' ? 'success' : 'warning'
                      }
                      className="bg-studio-surface/95"
                    >
                      {studioApplicationStatus[studio.status].label}
                    </StudioBadge>
                  </div>
                </div>
                <div className="p-studio-card">
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="font-heading text-lg font-semibold">
                      Thông tin studio
                    </h2>
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
                </div>
              </StudioCard>
              {studio.status !== 'suspended' && (
                <>
                  <StudioPaymentSettings studioId={studio.id} />
                  <FinancialAccountForm
                    endpoint={`/studios/${studio.id}/payout-account`}
                    title="Tài khoản nhận tiền"
                    description="Chủ studio nhập tài khoản nhận tiền và xác nhận lại mật khẩu. Quản trị đối chiếu trước khi chi trả."
                  />
                  <StudioEvidenceEditor key={studio.id} studio={studio} />
                </>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
