import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  ArrowUpRight,
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  CalendarPlus,
  Check,
  Circle,
  LifeBuoy,
  PanelsTopLeft,
  PlusCircle,
  Store,
  Ticket,
  UsersRound,
  WalletCards,
} from 'lucide-react';
import { apiFetch } from '../lib/api-client';
import { formatPrice, formatSessionDate } from '../lib/format';
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
      apiFetch<{
        summary: {
          pendingPayout: number;
          totalPaidOut: number;
          directCollected: number;
          settledDeposit: number;
        };
        currentAccount: {
          bankName: string;
          accountNumber: string;
          accountHolder: string;
          last4: string;
          status: 'pending' | 'verified' | 'rejected';
        } | null;
      }>(`/studios/${studio?.id}/finances`),
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

  const metricCards = [
    {
      label: 'Buổi sắp tới',
      value:
        sessions.isPending || sessions.error ? null : stats.upcomingSessions,
      note: 'Buổi đã lên lịch',
      icon: CalendarDays,
    },
    {
      label: 'Chỗ đã đặt',
      value:
        sessions.isPending || sessions.error ? null : totalUpcomingBookedSeats,
      note: 'Khách đã giữ / thanh toán',
      icon: UsersRound,
    },
    {
      label: 'Chỗ còn trống',
      value: sessions.isPending || sessions.error ? null : stats.availableSeats,
      note: 'Sẵn sàng đón khách mới',
      icon: Ticket,
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
      note: 'Đang mở nhận khách',
      icon: PanelsTopLeft,
    },
  ];

  return (
    <div className="space-y-6">
      <StudioNotifications studioId={studio.id} />

      {/* Header gọn gàng & đồng bộ */}
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
              <Button asChild size="sm">
                <Link to={studioPage(studio.id, 'sessions')}>
                  <CalendarPlus size={15} aria-hidden="true" />
                  Lên lịch buổi
                </Link>
              </Button>
              <Button asChild variant="secondary" size="sm">
                <Link to={studioPage(studio.id, 'workshops')}>
                  <PlusCircle size={15} aria-hidden="true" />
                  Tạo workshop
                </Link>
              </Button>
            </>
          )}
        </div>
      </header>

      {/* Banner cảnh báo chỉ hiển thị khi hồ sơ chưa duyệt hoặc cần chỉnh sửa */}
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
              <Button asChild size="sm" className="shrink-0 self-start">
                <Link to={`/dang-ky-studio?draftStudioId=${studio.id}`}>
                  Tiếp tục hoàn thiện hồ sơ
                </Link>
              </Button>
            ) : state !== 'suspended' ? (
              <Button
                asChild
                variant="secondary"
                size="sm"
                className="shrink-0 self-start"
              >
                <Link to={`${studioPage(studio.id, 'profile')}?edit=1`}>
                  Chỉnh sửa và gửi lại
                </Link>
              </Button>
            ) : null}
          </div>
        </StudioCard>
      )}

      {/* 4 Thẻ chỉ số tinh gọn, thoáng mắt */}
      {state === 'approved' && (
        <section
          aria-label="Số liệu studio"
          className="grid grid-cols-2 gap-3 sm:grid-cols-4"
        >
          {metricCards.map((item) => (
            <div
              key={item.label}
              className="rounded-studio-card border border-studio-border bg-studio-surface p-4 transition-colors hover:border-studio-primary/40"
            >
              <div className="flex items-center justify-between text-studio-muted">
                <span className="text-xs font-semibold uppercase tracking-wider text-studio-muted">
                  {item.label}
                </span>
                <item.icon
                  size={16}
                  aria-hidden="true"
                  className="shrink-0 text-studio-primary"
                />
              </div>
              <div className="mt-2 font-heading text-2xl sm:text-3xl font-bold tabular-nums text-studio-ink">
                {item.value === null ? (
                  <span role="status" aria-label="Đang tải">
                    <span
                      aria-hidden="true"
                      className="block h-7 w-12 rounded-studio-control bg-studio-subtle motion-safe:animate-pulse"
                    />
                  </span>
                ) : (
                  item.value
                )}
              </div>
              <p className="mt-1 text-xs text-studio-muted truncate">
                {item.note}
              </p>
            </div>
          ))}
        </section>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.65fr)_minmax(18rem,1fr)]">
        <div className="space-y-6 min-w-0">
          {!allChecklistCompleted ? (
            /* Khung Checklist cho studio đang bắt đầu */
            <StudioCard aria-labelledby="studio-checklist-title">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-studio-border pb-3">
                <div>
                  <h2
                    id="studio-checklist-title"
                    className="font-heading text-lg font-semibold text-studio-ink"
                  >
                    Các bước bắt đầu
                  </h2>
                  <p className="mt-0.5 text-xs text-studio-muted">
                    Hoàn thành 3 bước để sẵn sàng nhận đặt chỗ trực tuyến.
                  </p>
                </div>
                <span className="rounded-full bg-studio-subtle px-2.5 py-0.5 text-xs font-semibold tabular-nums text-studio-ink">
                  {progressKnown ? `${completed}/${checklist.length}` : '…'}
                </span>
              </div>

              {progressKnown ? (
                <progress
                  aria-label="Tiến độ các bước bắt đầu"
                  max={checklist.length}
                  value={completed}
                  className="studio-progress mt-4 h-1.5 w-full overflow-hidden rounded-full"
                />
              ) : !workshops.error && !sessions.error ? (
                <div
                  role="status"
                  aria-label="Đang tải"
                  className="mt-4 h-1.5 rounded-full bg-studio-subtle motion-safe:animate-pulse"
                />
              ) : null}

              <ul className="mt-3 divide-y divide-studio-border">
                {checklist.map((item) => (
                  <li key={item.label} className="flex items-center gap-3 py-3">
                    {item.done ? (
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-studio-success-soft text-studio-success">
                        <Check size={14} aria-label="Hoàn thành" />
                      </span>
                    ) : (
                      <Circle
                        size={18}
                        className="shrink-0 text-studio-muted"
                        aria-label={
                          item.pending ? 'Đang tải' : 'Chưa hoàn thành'
                        }
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      {item.to ? (
                        <Link
                          to={item.to}
                          className="inline-flex items-center gap-1.5 text-sm font-semibold text-studio-ink hover:text-studio-primary hover:underline"
                        >
                          {item.label}
                          <ArrowRight
                            size={14}
                            aria-hidden="true"
                            className="text-studio-muted"
                          />
                        </Link>
                      ) : (
                        <p className="text-sm font-semibold text-studio-ink">
                          {item.label}
                        </p>
                      )}
                      <p className="mt-0.5 text-xs text-studio-muted">
                        {item.detail}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>

              {(workshops.error || sessions.error) && (
                <p role="alert" className="mt-3 text-xs text-studio-danger">
                  Chưa tải được tiến độ.{' '}
                  <button
                    className="underline font-semibold"
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
          ) : (
            <>
              {/* Thao tác nhanh hiện đại, tinh gọn */}
              <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
                <Link
                  to={studioPage(studio.id, 'sessions')}
                  className="group flex flex-col justify-between rounded-studio-card border border-studio-border bg-studio-surface p-3.5 transition-all hover:border-studio-primary hover:shadow-studio-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-studio-primary"
                >
                  <span className="flex size-8 items-center justify-center rounded-md bg-studio-primary-soft text-studio-primary transition-transform group-hover:scale-105">
                    <CalendarPlus size={16} aria-hidden="true" />
                  </span>
                  <div className="mt-3">
                    <p className="text-sm font-semibold text-studio-ink group-hover:text-studio-primary">
                      Lên lịch buổi
                    </p>
                    <p className="mt-0.5 text-xs text-studio-muted line-clamp-1">
                      Thêm ngày giờ & số chỗ
                    </p>
                  </div>
                </Link>

                <Link
                  to={studioPage(studio.id, 'bookings')}
                  className="group flex flex-col justify-between rounded-studio-card border border-studio-border bg-studio-surface p-3.5 transition-all hover:border-studio-primary hover:shadow-studio-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-studio-primary"
                >
                  <span className="flex size-8 items-center justify-center rounded-md bg-studio-primary-soft text-studio-primary transition-transform group-hover:scale-105">
                    <CalendarCheck size={16} aria-hidden="true" />
                  </span>
                  <div className="mt-3">
                    <p className="text-sm font-semibold text-studio-ink group-hover:text-studio-primary">
                      Khách & Soát vé
                    </p>
                    <p className="mt-0.5 text-xs text-studio-muted line-clamp-1">
                      Điểm danh & thu số dư
                    </p>
                  </div>
                </Link>

                <Link
                  to={studioPage(studio.id, 'workshops')}
                  className="group flex flex-col justify-between rounded-studio-card border border-studio-border bg-studio-surface p-3.5 transition-all hover:border-studio-primary hover:shadow-studio-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-studio-primary"
                >
                  <span className="flex size-8 items-center justify-center rounded-md bg-studio-primary-soft text-studio-primary transition-transform group-hover:scale-105">
                    <PlusCircle size={16} aria-hidden="true" />
                  </span>
                  <div className="mt-3">
                    <p className="text-sm font-semibold text-studio-ink group-hover:text-studio-primary">
                      Thêm workshop
                    </p>
                    <p className="mt-0.5 text-xs text-studio-muted line-clamp-1">
                      Mở gói trải nghiệm mới
                    </p>
                  </div>
                </Link>

                <Link
                  to={studioPage(studio.id, 'finances')}
                  className="group flex flex-col justify-between rounded-studio-card border border-studio-border bg-studio-surface p-3.5 transition-all hover:border-studio-primary hover:shadow-studio-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-studio-primary"
                >
                  <span className="flex size-8 items-center justify-center rounded-md bg-studio-primary-soft text-studio-primary transition-transform group-hover:scale-105">
                    <WalletCards size={16} aria-hidden="true" />
                  </span>
                  <div className="mt-3">
                    <p className="text-sm font-semibold text-studio-ink group-hover:text-studio-primary">
                      Quyết toán sàn
                    </p>
                    <p className="mt-0.5 text-xs text-studio-muted line-clamp-1">
                      Tiền cọc & đối soát
                    </p>
                  </div>
                </Link>
              </div>

              {/* Buổi học sắp diễn ra gần nhất */}
              {nextSession ? (
                (() => {
                  const bookedSeats =
                    nextSession.seatsSold + nextSession.seatsHeld;
                  const remainingSeats = Math.max(
                    0,
                    nextSession.capacity - bookedSeats,
                  );
                  const occupancyPercent =
                    nextSession.capacity > 0
                      ? Math.min(
                          100,
                          Math.round(
                            (bookedSeats / nextSession.capacity) * 100,
                          ),
                        )
                      : 0;
                  return (
                    <StudioCard
                      aria-labelledby="next-session-title"
                      className="p-5"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-studio-border pb-3">
                        <div className="flex items-center gap-2">
                          <span className="flex size-6 items-center justify-center rounded-full bg-studio-primary-soft text-studio-primary">
                            <CalendarClock size={14} aria-hidden="true" />
                          </span>
                          <span className="text-xs font-semibold uppercase tracking-wider text-studio-muted">
                            Buổi học gần nhất
                          </span>
                        </div>
                        <StudioBadge
                          tone={
                            remainingSeats === 0
                              ? 'danger'
                              : remainingSeats <= 3
                                ? 'warning'
                                : 'success'
                          }
                          className="text-xs"
                        >
                          {remainingSeats === 0
                            ? 'Đã kín chỗ'
                            : remainingSeats <= 3
                              ? `Chỉ còn ${remainingSeats} chỗ`
                              : 'Đang mở đặt chỗ'}
                        </StudioBadge>
                      </div>

                      <div className="mt-3.5">
                        <h2
                          id="next-session-title"
                          className="font-heading text-lg sm:text-xl font-bold text-studio-ink"
                        >
                          {nextSession.workshopTitle}
                        </h2>
                        <p className="mt-1 text-sm font-medium text-studio-muted">
                          {formatSessionDate(nextSession.startsAt)}
                        </p>
                      </div>

                      {/* Thanh lấp đầy chỗ ngồi */}
                      <div className="mt-4 rounded-studio-control bg-studio-subtle/70 p-3.5">
                        <div className="flex items-center justify-between text-xs font-medium">
                          <span className="text-studio-muted">
                            Tỷ lệ lấp đầy:
                          </span>
                          <span className="font-semibold tabular-nums text-studio-ink">
                            {bookedSeats} / {nextSession.capacity} chỗ (
                            {occupancyPercent}%)
                          </span>
                        </div>
                        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-studio-border">
                          <div
                            className={`h-full transition-all duration-300 ${
                              occupancyPercent >= 100
                                ? 'bg-studio-danger'
                                : occupancyPercent >= 70
                                  ? 'bg-amber-500'
                                  : 'bg-studio-primary'
                            }`}
                            style={{ width: `${occupancyPercent}%` }}
                          />
                        </div>
                        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 text-xs text-studio-muted">
                          <span>
                            Đã bán:{' '}
                            <strong className="text-studio-ink font-semibold">
                              {nextSession.seatsSold}
                            </strong>
                          </span>
                          <span>
                            Đang giữ:{' '}
                            <strong className="text-studio-ink font-semibold">
                              {nextSession.seatsHeld}
                            </strong>
                          </span>
                          <span>
                            Còn trống:{' '}
                            <strong className="text-studio-ink font-semibold">
                              {remainingSeats}
                            </strong>
                          </span>
                          <span>
                            Giá:{' '}
                            <strong className="text-studio-ink font-semibold">
                              {formatPrice(nextSession.price)} đ
                            </strong>
                          </span>
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap items-center gap-2.5 pt-1">
                        <Button asChild size="sm">
                          <Link to={studioPage(studio.id, 'bookings')}>
                            <Ticket size={14} aria-hidden="true" />
                            Khách & Điểm danh
                          </Link>
                        </Button>
                        <Button asChild variant="secondary" size="sm">
                          <Link to={studioPage(studio.id, 'sessions')}>
                            Chi tiết lịch
                            <ArrowRight size={14} aria-hidden="true" />
                          </Link>
                        </Button>
                      </div>
                    </StudioCard>
                  );
                })()
              ) : (
                <StudioCard
                  aria-labelledby="next-session-title"
                  className="p-6 text-center"
                >
                  <div className="mx-auto flex size-10 items-center justify-center rounded-full bg-studio-subtle text-studio-muted">
                    <CalendarDays size={20} aria-hidden="true" />
                  </div>
                  <h2
                    id="next-session-title"
                    className="mt-3 font-heading text-base font-semibold text-studio-ink"
                  >
                    Chưa có buổi học nào sắp tới
                  </h2>
                  <p className="mx-auto mt-1 max-w-sm text-xs text-studio-muted">
                    Các buổi trước đã kết thúc hoặc bạn chưa lên lịch mới.
                  </p>
                  <div className="mt-3.5">
                    <Button asChild size="sm">
                      <Link to={studioPage(studio.id, 'sessions')}>
                        <CalendarPlus size={14} aria-hidden="true" />
                        Lên lịch buổi ngay
                      </Link>
                    </Button>
                  </div>
                </StudioCard>
              )}

              {/* Các buổi học tiếp theo */}
              {otherUpcoming.length > 0 && (
                <StudioCard
                  aria-labelledby="other-sessions-title"
                  className="p-4 sm:p-5"
                >
                  <div className="flex items-center justify-between gap-3 border-b border-studio-border pb-3">
                    <h2
                      id="other-sessions-title"
                      className="font-heading text-base font-semibold text-studio-ink"
                    >
                      Lịch các buổi tiếp theo
                    </h2>
                    <Link
                      to={studioPage(studio.id, 'sessions')}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-studio-primary hover:underline"
                    >
                      Xem tất cả ({allUpcoming.length})
                      <ArrowRight size={13} aria-hidden="true" />
                    </Link>
                  </div>
                  <ul className="divide-y divide-studio-border text-sm">
                    {otherUpcoming.map((item) => {
                      const itemBooked = item.seatsSold + item.seatsHeld;
                      const itemRemaining = Math.max(
                        0,
                        item.capacity - itemBooked,
                      );
                      return (
                        <li
                          key={item.id}
                          className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-2.5 last:pb-0"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-studio-ink">
                              {item.workshopTitle}
                            </p>
                            <p className="mt-0.5 text-xs text-studio-muted">
                              {formatSessionDate(item.startsAt)}
                            </p>
                          </div>
                          <div className="flex shrink-0 items-center gap-2.5">
                            <span className="text-xs tabular-nums text-studio-muted">
                              {itemBooked}/{item.capacity} chỗ
                            </span>
                            <StudioBadge
                              tone={
                                itemRemaining === 0
                                  ? 'danger'
                                  : itemRemaining <= 3
                                    ? 'warning'
                                    : 'neutral'
                              }
                              className="text-xs py-0.5 px-2"
                            >
                              {itemRemaining === 0
                                ? 'Hết chỗ'
                                : `Còn ${itemRemaining}`}
                            </StudioBadge>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </StudioCard>
              )}
            </>
          )}
        </div>

        {/* Cột thông tin phụ bên phải */}
        <aside className="space-y-5">
          {studio.role === 'owner' && state === 'approved' && (
            <StudioCard
              aria-labelledby="studio-finance-card-title"
              className="p-4 sm:p-5"
            >
              <div className="flex items-center justify-between gap-2 border-b border-studio-border pb-3">
                <div className="flex items-center gap-2">
                  <WalletCards
                    size={17}
                    aria-hidden="true"
                    className="shrink-0 text-studio-primary"
                  />
                  <h2
                    id="studio-finance-card-title"
                    className="font-heading text-base font-semibold text-studio-ink"
                  >
                    Doanh thu & Quyết toán
                  </h2>
                </div>
                <StudioBadge tone="neutral" className="text-xs py-0.5">
                  Tự động
                </StudioBadge>
              </div>

              <div className="mt-3.5 space-y-2.5">
                <div className="rounded-studio-control bg-studio-subtle/70 p-3">
                  <p className="text-xs font-medium text-studio-muted">
                    Tiền cọc Open Slot chuẩn bị chi trả
                  </p>
                  <p className="mt-1 font-heading text-2xl font-bold tabular-nums text-studio-primary">
                    {financesQuery.isPending
                      ? '…'
                      : `${formatPrice(financesQuery.data?.summary.pendingPayout ?? 0)} đ`}
                  </p>
                </div>

                <div className="rounded-studio-control border border-studio-border bg-studio-surface p-3">
                  <p className="text-xs font-medium text-studio-muted">
                    Tổng tiền đã nhận về tài khoản
                  </p>
                  <p className="mt-1 font-heading text-lg font-semibold tabular-nums text-studio-ink">
                    {financesQuery.isPending
                      ? '…'
                      : `${formatPrice(financesQuery.data?.summary.totalPaidOut ?? 0)} đ`}
                  </p>
                </div>

                {financesQuery.data?.currentAccount ? (
                  <div className="flex items-center justify-between gap-2 pt-1 text-xs text-studio-muted">
                    <span className="truncate">
                      {financesQuery.data.currentAccount.bankName} (••••{' '}
                      {financesQuery.data.currentAccount.last4})
                    </span>
                    <StudioBadge
                      tone={
                        financesQuery.data.currentAccount.status === 'verified'
                          ? 'success'
                          : 'warning'
                      }
                      className="px-2 py-0 text-[11px]"
                    >
                      {financesQuery.data.currentAccount.status === 'verified'
                        ? 'Đã xác minh'
                        : 'Chờ duyệt'}
                    </StudioBadge>
                  </div>
                ) : (
                  <p className="pt-1 text-xs text-amber-700">
                    Chưa cài đặt tài khoản ngân hàng nhận tiền.
                  </p>
                )}
              </div>

              <Link
                to={studioPage(studio.id, 'finances')}
                className="mt-3.5 inline-flex items-center gap-1.5 text-xs font-semibold text-studio-primary hover:underline"
              >
                Chi tiết dòng tiền & đối soát
                <ArrowRight size={13} aria-hidden="true" />
              </Link>
            </StudioCard>
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
