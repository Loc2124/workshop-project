import { Link, useParams } from 'react-router-dom';
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  Circle,
  LifeBuoy,
  PanelsTopLeft,
  Store,
  Ticket,
} from 'lucide-react';
import { StudioNotifications } from '../components/management/StudioNotifications';
import {
  StudioBadge,
  StudioButton as Button,
  StudioCard,
  StudioSkeleton,
} from '../components/management/StudioPrimitives';
import {
  useMyStudios,
  useStudioSessions,
  useStudioWorkshops,
} from '../hooks/useManagement';
import {
  studioDashboardStats,
  studioPage,
  studioState,
  studioStates,
} from '../lib/studio-dashboard';

export function StudioOverviewPage() {
  const { studioId } = useParams();
  const studiosQuery = useMyStudios();
  const studio = studiosQuery.data?.find(
    (item) => item.id === studioId && item.role === 'owner',
  );
  const workshops = useStudioWorkshops(
    studio && !studio.isDraft ? studio.id : '',
  );
  const sessions = useStudioSessions(
    studio && !studio.isDraft ? studio.id : '',
  );

  if (!studio) {
    return studiosQuery.isPending ? (
      <div className="space-y-studio-card">
        <h1 className="font-heading text-2xl font-semibold">Tổng quan</h1>
        <StudioSkeleton label="Đang tải thông tin studio…" />
      </div>
    ) : null;
  }

  const state = studioState(studio);
  const stats = studioDashboardStats(workshops.data ?? [], sessions.data ?? []);
  const checklist = [
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
  const badgeTone =
    state === 'approved'
      ? 'success'
      : state === 'pending' || state === 'needs_changes'
        ? 'warning'
        : state === 'rejected'
          ? 'danger'
          : 'neutral';

  const metricCards = [
    {
      label: 'Buổi sắp tới',
      value:
        sessions.isPending || sessions.error ? null : stats.upcomingSessions,
      note: 'Các buổi đã lên lịch trong tương lai',
      icon: CalendarDays,
    },
    {
      label: 'Workshop đang mở',
      value:
        workshops.isPending ||
        sessions.isPending ||
        workshops.error ||
        sessions.error
          ? null
          : stats.openWorkshops,
      note: 'Đã duyệt và còn chỗ trong lịch',
      icon: PanelsTopLeft,
    },
    {
      label: 'Slot còn trống',
      value: sessions.isPending || sessions.error ? null : stats.availableSeats,
      note: 'Tổng số chỗ còn lại trong lịch sắp tới',
      icon: Ticket,
    },
  ];

  return (
    <div className="space-y-studio-card">
      <StudioNotifications studioId={studio.id} />

      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-studio-muted">
            Khu vực quản lý studio
          </p>
          <h1 className="mt-1 font-heading text-2xl font-semibold sm:text-3xl">
            Tổng quan
          </h1>
        </div>
        {state === 'approved' && (
          <Button asChild variant="secondary">
            <Link to={`/studios/${studio.slug}`}>
              Xem trang công khai <ArrowUpRight size={16} aria-hidden="true" />
            </Link>
          </Button>
        )}
      </header>

      <StudioCard
        className="border-l-4 border-l-studio-primary bg-studio-selected p-5 sm:p-6"
        aria-labelledby="studio-welcome-title"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-medium text-studio-muted">
              Chào mừng bạn đến với khu vực quản lý
            </p>
            <h2
              id="studio-welcome-title"
              className="mt-2 break-words font-heading text-2xl font-semibold text-studio-ink sm:text-3xl"
            >
              {studio.isDraft ? 'Hồ sơ studio' : studio.name}
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-studio-muted">
              {studioStates[state].description}
            </p>
          </div>
          <StudioBadge tone={badgeTone} className="self-start">
            {studioStates[state].label}
          </StudioBadge>
        </div>

        {(state === 'rejected' ||
          state === 'needs_changes' ||
          state === 'suspended') && (
          <div className="mt-5 flex flex-col gap-4 rounded-studio-control border border-studio-danger/20 bg-studio-surface p-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 text-sm leading-6">
              <p className="font-semibold text-studio-danger">
                {state === 'suspended'
                  ? 'Lý do tạm ngưng'
                  : state === 'needs_changes'
                    ? 'Nội dung cần bổ sung'
                    : 'Lý do từ chối'}
              </p>
              <p className="mt-1 text-studio-ink">
                {studio.rejectionReason ||
                  'Chưa có lý do được ghi nhận. Vui lòng liên hệ Open Slot để xác nhận thông tin cần bổ sung.'}
              </p>
            </div>
            {state !== 'suspended' && (
              <Button
                asChild
                variant="secondary"
                className="shrink-0 self-start"
              >
                <Link to={`${studioPage(studio.id, 'profile')}?edit=1`}>
                  Chỉnh sửa và gửi lại
                </Link>
              </Button>
            )}
          </div>
        )}

        {state === 'draft' && (
          <Button asChild className="mt-5">
            <Link to={`/dang-ky-studio?draftStudioId=${studio.id}`}>
              Tiếp tục hoàn thiện hồ sơ
            </Link>
          </Button>
        )}
      </StudioCard>

      {state === 'approved' && (
        <section
          aria-label="Số liệu studio"
          className="grid gap-4 sm:grid-cols-3"
        >
          {metricCards.map((item) => (
            <StudioCard
              key={item.label}
              className="min-w-0 transition-shadow duration-studio hover:shadow-studio-hover motion-reduce:transition-none"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-studio-muted">
                  {item.label}
                </p>
                <item.icon
                  size={19}
                  aria-hidden="true"
                  className="shrink-0 text-studio-primary"
                />
              </div>
              <div className="my-3 min-h-9 font-heading text-3xl font-semibold leading-none tabular-nums text-studio-ink">
                {item.value === null ? (
                  <span role="status" aria-label="Đang tải">
                    <span
                      aria-hidden="true"
                      className="block h-8 w-14 rounded-studio-control bg-studio-subtle motion-safe:animate-pulse"
                    />
                  </span>
                ) : (
                  item.value
                )}
              </div>
              <p className="text-sm leading-6 text-studio-muted">{item.note}</p>
            </StudioCard>
          ))}
        </section>
      )}

      <div className="grid items-start gap-studio-card lg:grid-cols-[minmax(0,1.55fr)_minmax(18rem,1fr)]">
        <StudioCard aria-labelledby="studio-checklist-title">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2
                id="studio-checklist-title"
                className="font-heading text-xl font-semibold"
              >
                Các bước bắt đầu
              </h2>
              <p className="mt-1 text-sm text-studio-muted">
                Hoàn thành từng bước để sẵn sàng đón khách.
              </p>
            </div>
            <span className="rounded-full bg-studio-subtle px-3 py-1 text-sm font-semibold tabular-nums text-studio-ink">
              {progressKnown ? `${completed}/${checklist.length}` : '…'}
            </span>
          </div>
          {progressKnown ? (
            <progress
              aria-label="Tiến độ các bước bắt đầu"
              max={checklist.length}
              value={completed}
              className="studio-progress mt-5 h-2 w-full overflow-hidden rounded-full"
            />
          ) : !workshops.error && !sessions.error ? (
            <div
              role="status"
              aria-label="Đang tải"
              className="mt-5 h-2 rounded-full bg-studio-subtle motion-safe:animate-pulse"
            />
          ) : null}
          <ul className="mt-3 divide-y divide-studio-border">
            {checklist.map((item) => (
              <li
                key={item.label}
                className="flex min-h-[4.5rem] items-center gap-3 py-3"
              >
                {item.done ? (
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-studio-success-soft text-studio-success">
                    <Check size={16} aria-label="Hoàn thành" />
                  </span>
                ) : (
                  <Circle
                    size={20}
                    className="shrink-0 text-studio-muted"
                    aria-label={item.pending ? 'Đang tải' : 'Chưa hoàn thành'}
                  />
                )}
                <div className="min-w-0 flex-1">
                  {item.to ? (
                    <Link
                      to={item.to}
                      className="inline-flex min-h-8 items-center gap-2 rounded-sm text-sm font-semibold text-studio-ink underline-offset-4 transition-colors duration-studio hover:text-studio-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-studio-primary focus-visible:ring-offset-2 motion-reduce:transition-none"
                    >
                      {item.label}
                      <ArrowRight
                        size={15}
                        aria-hidden="true"
                        className="text-studio-muted"
                      />
                    </Link>
                  ) : (
                    <p className="text-sm font-semibold text-studio-ink">
                      {item.label}
                    </p>
                  )}
                  <p className="mt-1 text-sm leading-5 text-studio-muted">
                    {item.detail}
                  </p>
                </div>
              </li>
            ))}
          </ul>
          {(workshops.error || sessions.error) && (
            <p role="alert" className="mt-3 text-sm text-studio-danger">
              Chưa tải được tiến độ.{' '}
              <button
                className="rounded-sm font-semibold underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-studio-primary focus-visible:ring-offset-2"
                onClick={() => {
                  void workshops.refetch();
                  void sessions.refetch();
                }}
              >
                Thử lại
              </button>
            </p>
          )}
        </StudioCard>

        <aside className="space-y-studio-card">
          <StudioCard aria-labelledby="studio-information-title">
            <div className="flex items-center gap-3">
              <Store
                size={19}
                aria-hidden="true"
                className="shrink-0 text-studio-primary"
              />
              <h2
                id="studio-information-title"
                className="font-heading text-xl font-semibold"
              >
                Thông tin studio
              </h2>
            </div>
            <p className="mt-4 break-words font-semibold">
              {studio.isDraft ? 'Hồ sơ nháp' : studio.name}
            </p>
            <dl className="mt-4 divide-y divide-studio-border text-sm">
              {[
                [
                  'Địa chỉ',
                  [studio.address, studio.province].filter(Boolean).join(', '),
                ],
                ['Số điện thoại', studio.contactPhone],
                ['Email', studio.contactEmail],
              ].map(([label, value]) => (
                <div key={label} className="py-3 first:pt-0 last:pb-0">
                  <dt className="text-studio-muted">{label}</dt>
                  <dd className="mt-1 break-words font-medium text-studio-ink">
                    {value || 'Chưa bổ sung'}
                  </dd>
                </div>
              ))}
            </dl>
            <Link
              to={studioPage(studio.id, 'profile')}
              className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-sm text-sm font-semibold text-studio-primary underline-offset-4 transition-colors duration-studio hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-studio-primary focus-visible:ring-offset-2 motion-reduce:transition-none"
            >
              Xem hồ sơ studio
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </StudioCard>

          <StudioCard aria-labelledby="studio-support-title">
            <div className="flex items-center gap-3">
              <LifeBuoy
                size={19}
                aria-hidden="true"
                className="shrink-0 text-studio-accent"
              />
              <h2
                id="studio-support-title"
                className="font-heading text-xl font-semibold"
              >
                Liên hệ hỗ trợ
              </h2>
            </div>
            <p className="mt-3 text-sm leading-6 text-studio-muted">
              Cần hỗ trợ hồ sơ hoặc lịch workshop? Xem hướng dẫn đăng ký và các
              thông tin Open Slot dành cho nghệ nhân.
            </p>
            <Link
              to="/danh-cho-nghe-nhan"
              className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-sm text-sm font-semibold text-studio-primary underline-offset-4 transition-colors duration-studio hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-studio-primary focus-visible:ring-offset-2 motion-reduce:transition-none"
            >
              Hướng dẫn dành cho nghệ nhân
              <ArrowUpRight size={16} aria-hidden="true" />
            </Link>
          </StudioCard>
        </aside>
      </div>
    </div>
  );
}
