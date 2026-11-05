import { Link, useParams } from 'react-router-dom';
import { StudioNotifications } from '../components/management/StudioNotifications';
import {
  ArrowUpRight,
  Check,
  Circle,
  CalendarDays,
  PanelsTopLeft,
  Ticket,
  ArrowRight,
  LifeBuoy,
  Store,
} from 'lucide-react';
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
import {
  StudioBadge,
  StudioButton as Button,
  StudioCard,
  StudioSkeleton,
} from '../components/management/StudioPrimitives';

export function StudioOverviewPage() {
  const { studioId } = useParams();
  const studiosQuery = useMyStudios();
  const studio = studiosQuery.data?.find(
    (s) => s.id === studioId && s.role === 'owner',
  );
  const workshops = useStudioWorkshops(
    studio && !studio.isDraft ? studio.id : '',
  );
  const sessions = useStudioSessions(
    studio && !studio.isDraft ? studio.id : '',
  );
  if (!studio)
    return studiosQuery.isPending ? (
      <div className="space-y-studio-card">
        <h1 className="font-heading text-3xl font-bold">Tổng quan</h1>
        <StudioSkeleton label="Đang tải thông tin studio…" />
      </div>
    ) : null;
  const state = studioState(studio);
  const stats = studioDashboardStats(workshops.data ?? [], sessions.data ?? []);
  const checklist = [
    {
      label: 'Hồ sơ đã gửi',
      done: !studio.isDraft,
      to: studio.isDraft
        ? `/dang-ky-studio?draftStudioId=${studio.id}`
        : studioPage(studio.id, 'profile'),
      pending: false,
    },
    {
      label: 'Tạo workshop đầu tiên',
      done: Boolean(workshops.data?.length),
      to: studio.isDraft ? undefined : studioPage(studio.id, 'workshops'),
      pending: workshops.isPending && !studio.isDraft,
    },
    {
      label: 'Thêm slot đầu tiên',
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
  return (
    <div className="space-y-studio-card">
      <StudioNotifications studioId={studio.id} />
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-heading text-2xl font-semibold">Tổng quan</h1>
        <StudioCard
          className="bg-studio-selected"
          aria-labelledby="studio-status-title"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2
              id="studio-status-title"
              className="font-heading text-lg font-semibold"
            >
              Trạng thái hồ sơ
            </h2>
            <StudioBadge
              tone={
                state === 'approved'
                  ? 'success'
                  : state === 'pending' || state === 'needs_changes'
                    ? 'warning'
                    : state === 'rejected'
                      ? 'danger'
                      : 'neutral'
              }
            >
              {studioStates[state].label}
            </StudioBadge>
          </div>
          <p className="mt-4 font-heading text-2xl font-bold text-studio-primary">
            {studio.isDraft ? 'Hồ sơ nháp' : studio.name}
          </p>
          <p className="mt-2 text-sm text-studio-muted">
            {studio.isDraft
              ? 'Hồ sơ chưa gửi'
              : `Đã gửi ngày ${new Date(studio.createdAt).toLocaleDateString('vi-VN')}`}
          </p>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-studio-muted">
            {studioStates[state].description}
          </p>
          {(state === 'rejected' ||
            state === 'needs_changes' ||
            state === 'suspended') && (
            <>
              <div className="mt-4 rounded-studio-control bg-studio-danger-soft p-4 text-sm text-studio-danger">
                <p className="font-medium">
                  {state === 'suspended'
                    ? 'Lý do tạm ngưng'
                    : state === 'needs_changes'
                      ? 'Nội dung cần bổ sung'
                      : 'Lý do từ chối'}
                </p>
                <p className="mt-1">
                  {studio.rejectionReason ||
                    'Chưa có lý do được ghi nhận. Vui lòng liên hệ Open Slot để xác nhận thông tin cần bổ sung.'}
                </p>
              </div>
              {state !== 'suspended' && (
                <Button asChild className="mt-4">
                  <Link to={`${studioPage(studio.id, 'profile')}?edit=1`}>
                    Chỉnh sửa và gửi lại
                  </Link>
                </Button>
              )}
            </>
          )}
          {state === 'draft' && (
            <Button asChild className="mt-4">
              <Link to={`/dang-ky-studio?draftStudioId=${studio.id}`}>
                Tiếp tục hoàn thiện hồ sơ
              </Link>
            </Button>
          )}
        </StudioCard>
        {state === 'approved' && (
          <Button asChild variant="secondary">
            <Link to={`/studios/${studio.slug}`}>
              Xem trang công khai <ArrowUpRight size={16} aria-hidden="true" />
            </Link>
          </Button>
        )}
      </header>
      {state === 'approved' && (
        <section
          aria-label="Số liệu studio"
          className="grid gap-studio-group sm:grid-cols-3"
        >
          {[
            {
              label: 'Đặt chỗ sắp tới',
              icon: Ticket,
              loading: false,
              value: '—',
              note: 'Chưa có dữ liệu đặt chỗ',
            },
            {
              label: 'Workshop đang mở',
              icon: PanelsTopLeft,
              loading: workshops.isPending || sessions.isPending,
              value:
                workshops.isPending ||
                sessions.isPending ||
                workshops.error ||
                sessions.error
                  ? '—'
                  : stats.openWorkshops,
              note: 'Đã duyệt, có lịch còn chỗ',
            },
            {
              label: 'Slot còn trống',
              icon: CalendarDays,
              loading: sessions.isPending,
              value:
                sessions.isPending || sessions.error
                  ? '—'
                  : stats.availableSeats,
              note: 'Số chỗ còn lại trong lịch sắp tới',
            },
          ].map((item) => (
            <StudioCard
              key={item.label}
              className="min-w-0 transition-shadow duration-studio hover:shadow-studio-hover motion-reduce:transition-none"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-medium text-studio-muted">
                  {item.label}
                </p>
                <item.icon
                  size={20}
                  aria-hidden="true"
                  className="shrink-0 text-studio-primary"
                />
              </div>
              <div className="my-3 min-h-10 text-4xl font-semibold leading-none tabular-nums text-studio-ink">
                {item.loading ? (
                  <span role="status" aria-label="Đang tải">
                    <span
                      aria-hidden="true"
                      className="block h-10 w-16 rounded-studio-control bg-studio-subtle motion-safe:animate-pulse"
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
      <div className="grid items-start gap-studio-card lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="space-y-studio-card">
          <StudioCard aria-labelledby="studio-checklist-title">
            <h2
              id="studio-checklist-title"
              className="font-heading text-lg font-semibold"
            >
              Các bước bắt đầu
            </h2>
            {progressKnown ? (
              <div className="mt-4 flex items-center gap-4">
                <progress
                  aria-labelledby="studio-checklist-title"
                  max={checklist.length}
                  value={completed}
                  className="studio-progress h-2 min-w-0 flex-1 overflow-hidden rounded-full"
                />
                <span className="shrink-0 text-sm font-semibold tabular-nums text-studio-primary">
                  {completed}/{checklist.length}
                </span>
              </div>
            ) : !workshops.error && !sessions.error ? (
              <div
                role="status"
                aria-label="Đang tải"
                className="mt-4 h-2 rounded-full bg-studio-subtle motion-safe:animate-pulse"
              />
            ) : null}
            <ul className="mt-4 divide-y divide-studio-border">
              {checklist.map((item) => (
                <li
                  key={item.label}
                  className="flex min-h-16 items-center gap-3 py-3"
                >
                  {item.done ? (
                    <Check
                      size={18}
                      className="size-6 shrink-0 rounded-full bg-studio-success-soft p-1 text-studio-success"
                      aria-label="Hoàn thành"
                    />
                  ) : (
                    <Circle
                      size={18}
                      className="shrink-0 text-studio-muted"
                      aria-label={item.pending ? 'Đang tải' : 'Chưa hoàn thành'}
                    />
                  )}
                  {item.to ? (
                    <Link
                      to={item.to}
                      className="flex min-h-11 min-w-0 flex-1 items-center justify-between gap-3 rounded-studio-control text-sm font-medium text-studio-ink underline-offset-4 hover:text-studio-primary hover:underline"
                    >
                      {item.label}
                      <ArrowRight
                        size={16}
                        aria-hidden="true"
                        className="shrink-0 text-studio-muted"
                      />
                    </Link>
                  ) : (
                    <span className="text-sm text-studio-muted">
                      {item.label}
                      <span className="mt-1 block text-sm">
                        {studio.isDraft
                          ? 'Hoàn thiện và gửi hồ sơ trước'
                          : 'Mở sau khi studio được duyệt'}
                      </span>
                    </span>
                  )}
                </li>
              ))}
            </ul>
            {(workshops.error || sessions.error) && (
              <p role="alert" className="mt-2 text-sm text-brick">
                Chưa tải được tiến độ.{' '}
                <button
                  className="underline"
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
        </div>
        <aside className="space-y-studio-card">
          <StudioCard>
            <Store
              size={22}
              aria-hidden="true"
              className="mb-3 text-studio-primary"
            />
            <h2 className="font-heading text-lg font-semibold">
              Thông tin studio
            </h2>
            <p className="mt-3 font-medium">
              {studio.isDraft ? 'Hồ sơ nháp' : studio.name}
            </p>
            <dl className="mt-4 space-y-4 text-sm">
              {[
                [
                  'Địa chỉ',
                  [studio.address, studio.province].filter(Boolean).join(', '),
                ],
                ['Số điện thoại', studio.contactPhone],
                ['Email', studio.contactEmail],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-sm text-studio-muted">{label}</dt>
                  <dd className="mt-1 break-words">
                    {value || 'Chưa bổ sung'}
                  </dd>
                </div>
              ))}
            </dl>
            <Link
              to={studioPage(studio.id, 'profile')}
              className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-studio-control text-sm font-semibold text-studio-primary underline-offset-4 hover:underline"
            >
              Xem hồ sơ studio
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </StudioCard>
          <StudioCard>
            <LifeBuoy
              size={22}
              aria-hidden="true"
              className="mb-3 text-studio-accent"
            />
            <h2 className="font-heading text-lg font-semibold">
              Liên hệ hỗ trợ
            </h2>
            <p className="mt-3 text-sm leading-6 text-studio-muted">
              Cần hỗ trợ hồ sơ hoặc lịch workshop? Xem hướng dẫn đăng ký và các
              thông tin Open Slot dành cho nghệ nhân.
            </p>
            <Link
              to="/danh-cho-nghe-nhan"
              className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-studio-control text-sm font-semibold text-studio-primary underline-offset-4 hover:underline"
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
