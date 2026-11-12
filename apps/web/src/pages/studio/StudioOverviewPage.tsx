import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  ArrowUpRight,
  CalendarPlus,
  LifeBuoy,
  PlusCircle,
  Store,
} from 'lucide-react';
import { apiFetch } from '../../lib/api-client';
import { StudioNotifications } from '../../components/management/StudioNotifications';
import {
  StudioBadge,
  StudioButton as Button,
  StudioCard,
  StudioSkeleton,
} from '../../components/management/StudioPrimitives';
import {
  useMyStudios,
  useStudioSessions,
  useStudioWorkshops,
} from '../../hooks/useManagement';
import {
  studioDashboardStats,
  studioPage,
  studioState,
  studioStates,
} from '../../lib/studio-dashboard';
import { OverviewMetricsCards } from '../../components/management/overview/OverviewMetricsCards';
import {
  OverviewChecklistCard,
  type ChecklistItem,
} from '../../components/management/overview/OverviewChecklistCard';
import { OverviewQuickActions } from '../../components/management/overview/OverviewQuickActions';
import { OverviewNextSessionCard } from '../../components/management/overview/OverviewNextSessionCard';
import { OverviewUpcomingSessionsList } from '../../components/management/overview/OverviewUpcomingSessionsList';
import {
  OverviewFinancesCard,
  type StudioFinancesData,
} from '../../components/management/overview/OverviewFinancesCard';

export function StudioOverviewPage() {
  const { studioId } = useParams();
  const studiosQuery = useMyStudios();
  const studio = studiosQuery.data?.find((item) => item.id === studioId);
  const workshops = useStudioWorkshops(
    studio && !studio.isDraft ? studio.id : '',
  );
  const sessions = useStudioSessions(
    studio && !studio.isDraft ? studio.id : '',
  );

  const state = studio ? studioState(studio) : 'draft';

  const financesQuery = useQuery({
    queryKey: ['studio-finances', studio?.id],
    queryFn: () =>
      apiFetch<StudioFinancesData>(`/studios/${studio?.id}/finances`),
    enabled: Boolean(studio && studio.role === 'owner' && state === 'approved'),
    staleTime: 60_000,
  });

  if (!studio) {
    return studiosQuery.isPending ? (
      <div className="space-y-studio-card">
        <h1 className="font-heading text-2xl font-semibold">Tổng quan</h1>
        <StudioSkeleton label="Đang tải thông tin studio…" />
      </div>
    ) : null;
  }

  const stats = studioDashboardStats(workshops.data ?? [], sessions.data ?? []);
  const checklist: ChecklistItem[] = [
    {
      label: 'Hồ sơ đã gửi',
      detail: studio.isDraft
        ? 'Hoàn thiện thông tin để gửi xét duyệt.'
        : `Đã gửi ngày ${new Date(studio.createdAt).toLocaleDateString('vi-VN')}`,
      done: !studio.isDraft,
      to: studio.isDraft
        ? `/dang-ky-studio?draftStudioId=${studio.id}`
        : studioPage(studio.id, 'profile'),
      pending: false,
    },
    {
      label: 'Tạo workshop đầu tiên',
      detail: 'Giới thiệu trải nghiệm và mức giá của bạn.',
      done: Boolean(workshops.data?.length),
      to: studio.isDraft ? undefined : studioPage(studio.id, 'workshops'),
      pending: workshops.isPending && !studio.isDraft,
    },
    {
      label: 'Thêm slot đầu tiên',
      detail:
        studio.status === 'approved'
          ? 'Chọn ngày, giờ và số chỗ cho buổi đầu tiên.'
          : 'Mở sau khi studio được duyệt.',
      done: Boolean(sessions.data?.length),
      to:
        studio.status === 'approved'
          ? studioPage(studio.id, 'sessions')
          : undefined,
      pending: sessions.isPending && !studio.isDraft,
    },
  ];
  const completed = checklist.filter((item) => item.done).length;
  const progressKnown =
    !checklist.some((item) => item.pending) &&
    !workshops.error &&
    !sessions.error;
  const allChecklistCompleted = progressKnown && completed === checklist.length;

  const now = Date.now();
  const allUpcoming = (sessions.data ?? [])
    .filter((s) => s.status === 'scheduled' && Date.parse(s.startsAt) >= now)
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
  const nextSession = allUpcoming[0] ?? null;
  const otherUpcoming = allUpcoming.slice(1, 4);
  const totalUpcomingBookedSeats = allUpcoming.reduce(
    (sum, s) => sum + s.seatsSold + s.seatsHeld,
    0,
  );

  const badgeTone =
    state === 'approved'
      ? 'success'
      : state === 'pending' || state === 'needs_changes'
        ? 'warning'
        : state === 'rejected'
          ? 'danger'
          : 'neutral';

  return (
    <div className="space-y-6">
      <StudioNotifications studioId={studio.id} />

      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-studio-border pb-4">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="font-heading text-2xl font-bold tracking-tight text-studio-ink sm:text-3xl">
              Tổng quan
            </h1>
            <StudioBadge tone={badgeTone}>
              {studioStates[state].label}
            </StudioBadge>
          </div>
          <p className="mt-1 text-sm text-studio-muted">
            {studio.isDraft ? 'Hồ sơ nháp' : studio.name} ·{' '}
            {[studio.address, studio.province].filter(Boolean).join(', ') ||
              'Chưa cập nhật địa chỉ'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {state === 'approved' && (
            <>
              <Button asChild size="sm" className="min-h-11">
                <Link to={studioPage(studio.id, 'sessions')}>
                  <CalendarPlus size={15} aria-hidden="true" />
                  Lên lịch buổi
                </Link>
              </Button>
              <Button
                asChild
                variant="secondary"
                size="sm"
                className="min-h-11"
              >
                <Link to={studioPage(studio.id, 'workshops')}>
                  <PlusCircle size={15} aria-hidden="true" />
                  Tạo workshop
                </Link>
              </Button>
            </>
          )}
        </div>
      </header>

      {/* Banner cảnh báo khi hồ sơ chưa duyệt hoặc cần bổ sung */}
      {(state === 'rejected' ||
        state === 'needs_changes' ||
        state === 'suspended' ||
        state === 'draft') && (
        <StudioCard
          className="border-l-4 border-l-studio-primary bg-studio-selected p-4 sm:p-5"
          aria-labelledby="studio-status-alert-title"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h2
                id="studio-status-alert-title"
                className="font-heading text-lg font-semibold text-studio-ink"
              >
                {state === 'draft'
                  ? 'Hồ sơ studio chưa hoàn tất'
                  : state === 'suspended'
                    ? 'Studio đang tạm ngưng hoạt động'
                    : state === 'needs_changes'
                      ? 'Yêu cầu bổ sung thông tin hồ sơ'
                      : 'Hồ sơ chưa được duyệt'}
              </h2>
              <p className="mt-1 text-sm text-studio-muted">
                {studio.rejectionReason || studioStates[state].description}
              </p>
            </div>
            {state === 'draft' ? (
              <Button
                asChild
                size="sm"
                className="shrink-0 self-start min-h-11"
              >
                <Link to={`/dang-ky-studio?draftStudioId=${studio.id}`}>
                  Tiếp tục hoàn thiện hồ sơ
                </Link>
              </Button>
            ) : state !== 'suspended' ? (
              <Button
                asChild
                variant="secondary"
                size="sm"
                className="shrink-0 self-start min-h-11"
              >
                <Link to={`${studioPage(studio.id, 'profile')}?edit=1`}>
                  Chỉnh sửa và gửi lại
                </Link>
              </Button>
            ) : null}
          </div>
        </StudioCard>
      )}

      {/* 4 Thẻ chỉ số */}
      {state === 'approved' && (
        <OverviewMetricsCards
          upcomingSessions={
            sessions.isPending || sessions.error ? null : stats.upcomingSessions
          }
          totalUpcomingBookedSeats={
            sessions.isPending || sessions.error
              ? null
              : totalUpcomingBookedSeats
          }
          availableSeats={
            sessions.isPending || sessions.error ? null : stats.availableSeats
          }
          openWorkshops={
            workshops.isPending ||
            sessions.isPending ||
            workshops.error ||
            sessions.error
              ? null
              : stats.openWorkshops
          }
        />
      )}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.65fr)_minmax(18rem,1fr)]">
        <div className="space-y-6 min-w-0">
          {!allChecklistCompleted ? (
            <OverviewChecklistCard
              checklist={checklist}
              completed={completed}
              progressKnown={progressKnown}
              hasError={Boolean(workshops.error || sessions.error)}
              onRetry={() => {
                void workshops.refetch();
                void sessions.refetch();
              }}
            />
          ) : (
            <>
              <OverviewQuickActions studioId={studio.id} />
              <OverviewNextSessionCard
                studioId={studio.id}
                nextSession={nextSession}
              />
              <OverviewUpcomingSessionsList
                studioId={studio.id}
                sessions={otherUpcoming}
                totalUpcomingCount={allUpcoming.length}
              />
            </>
          )}
        </div>

        {/* Cột thông tin phụ bên phải */}
        <aside className="space-y-5">
          {studio.role === 'owner' && state === 'approved' && (
            <OverviewFinancesCard
              studioId={studio.id}
              financesData={financesQuery.data}
              isLoading={financesQuery.isPending}
            />
          )}

          <StudioCard
            aria-labelledby="studio-information-title"
            className="p-4 sm:p-5"
          >
            <div className="flex items-center gap-2 border-b border-studio-border pb-3">
              <Store
                size={17}
                aria-hidden="true"
                className="shrink-0 text-studio-primary"
              />
              <h2
                id="studio-information-title"
                className="font-heading text-base font-semibold text-studio-ink"
              >
                Thông tin studio
              </h2>
            </div>
            <dl className="mt-3 divide-y divide-studio-border text-xs">
              {[
                [
                  'Địa chỉ',
                  [studio.address, studio.province].filter(Boolean).join(', '),
                ],
                ['Số điện thoại', studio.contactPhone],
                ['Email', studio.contactEmail],
              ].map(([label, value]) => (
                <div key={label} className="py-2.5 first:pt-0 last:pb-0">
                  <dt className="text-studio-muted">{label}</dt>
                  <dd className="mt-0.5 break-words font-medium text-studio-ink">
                    {value || 'Chưa bổ sung'}
                  </dd>
                </div>
              ))}
            </dl>
            <Link
              to={studioPage(studio.id, 'profile')}
              className="mt-3.5 inline-flex items-center gap-1.5 text-xs font-semibold text-studio-primary hover:underline"
            >
              Hồ sơ & Tài khoản studio
              <ArrowRight size={13} aria-hidden="true" />
            </Link>
          </StudioCard>

          <StudioCard
            aria-labelledby="studio-support-title"
            className="p-4 sm:p-5"
          >
            <div className="flex items-center gap-2 border-b border-studio-border pb-3">
              <LifeBuoy
                size={17}
                aria-hidden="true"
                className="shrink-0 text-studio-accent"
              />
              <h2
                id="studio-support-title"
                className="font-heading text-base font-semibold text-studio-ink"
              >
                Hỗ trợ nghệ nhân
              </h2>
            </div>
            <p className="mt-2.5 text-xs leading-5 text-studio-muted">
              Xem quy trình duyệt workshop, chính sách đặt cọc và hướng dẫn dành
              cho nghệ nhân.
            </p>
            <Link
              to="/danh-cho-nghe-nhan"
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-studio-primary hover:underline"
            >
              Xem cẩm nang nghệ nhân
              <ArrowUpRight size={13} aria-hidden="true" />
            </Link>
          </StudioCard>
        </aside>
      </div>
    </div>
  );
}
export default StudioOverviewPage;
