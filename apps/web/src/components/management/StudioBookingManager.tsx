import { useMemo, useState } from 'react';
import { StudioAttendancePanel } from './StudioAttendancePanel';
import { StudioRefundPanel } from './StudioRefundPanel';
import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import { z } from 'zod';
import { apiFetch } from '../../lib/api-client';
import { useAuth } from '../../hooks/useAuth';
import { queryKeys } from '../../lib/query-keys';
import { formatPrice } from '../../lib/format';
import {
  CalendarClock,
  Check,
  CheckCircle2,
  ClipboardList,
  Coins,
  Copy,
  Phone,
  RefreshCw,
  Search,
  UsersRound,
  X,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '../ui/dialog';
import {
  dateLabel,
  paymentLabel,
  reservationLabel,
} from '../../pages/CustomerBookingsPage';
import {
  StudioBadge,
  StudioButton,
  StudioCard,
  StudioEmptyState,
  StudioSkeleton,
} from './StudioPrimitives';

const responseSchema = z.object({
  bookings: z.array(
    z.object({
      id: z.uuid(),
      orderCode: z.string(),
      quantity: z.number(),
      contactName: z.string(),
      contactPhone: z.string().nullable(),
      totalAmount: z.number(),
      paidAmount: z.number(),
      depositAmount: z.number(),
      paymentMode: z.string(),
      refundStatus: z.string().optional(),
      refundDueAmount: z.number().optional(),
      refundedAmount: z.number().optional(),
      reschedulePending: z.boolean().optional(),
      seatRevision: z.number().int().optional(),
      balanceAmount: z.number(),
      reservationStatus: z.string(),
      paymentStatus: z.string(),
      startsAt: z.string(),
      endsAt: z.string().optional(),
      attendanceStatus: z.string().optional(),
      workshopTitle: z.string(),
    }),
  ),
});
type Booking = z.infer<typeof responseSchema>['bookings'][number];

export const prefetchData = (
  client: QueryClient,
  userId: string,
  studioId: string,
) =>
  client.prefetchQuery({
    queryKey: queryKeys.bookings.forStudio(userId, studioId),
    queryFn: async ({ signal }) =>
      responseSchema.parse(
        await apiFetch(`/studios/${studioId}/bookings`, { signal }),
      ).bookings,
    staleTime: 30_000,
  });

type FilterTab =
  'all' | 'needs_collection' | 'paid' | 'reschedule' | 'cancelled';

export function StudioBookingManager({ studioId }: { studioId: string }) {
  const { user } = useAuth();
  const client = useQueryClient();
  const key = queryKeys.bookings.forStudio(user?.id, studioId);
  const [selected, setSelected] = useState<Booking | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [selectedWorkshop, setSelectedWorkshop] = useState<string>('all');

  const query = useQuery({
    queryKey: key,
    queryFn: async ({ signal }) =>
      responseSchema.parse(
        await apiFetch<unknown>(`/studios/${studioId}/bookings`, { signal }),
      ).bookings,
    refetchInterval: 30000,
    enabled: Boolean(user),
  });

  const payment = useMutation({
    mutationFn: (booking: Booking) =>
      apiFetch(`/studios/${studioId}/bookings/${booking.id}/confirm-payment`, {
        method: 'POST',
        body: JSON.stringify({ expectedAmount: booking.balanceAmount }),
      }),
    onSuccess: async () => {
      setSelected(null);
      await client.invalidateQueries({ queryKey: key });
    },
  });

  const paymentTone = (status: string) => {
    if (status === 'paid') return 'success' as const;
    if (status === 'pending' || status === 'refund_needed')
      return 'warning' as const;
    if (['cancelled', 'expired', 'failed'].includes(status))
      return 'danger' as const;
    return 'neutral' as const;
  };

  const reservationTone = (status: string) => {
    if (status === 'confirmed' || status === 'completed')
      return 'success' as const;
    if (status === 'pending') return 'warning' as const;
    if (status === 'cancelled') return 'danger' as const;
    return 'neutral' as const;
  };

  const isEligibleForCollection = (b: Booking) => {
    return (
      ['confirmed', 'completed'].includes(b.reservationStatus) &&
      b.paymentStatus === 'pending' &&
      !b.reschedulePending &&
      ((b.seatRevision ?? 0) > 0 ||
        !['pending', 'refunded'].includes(b.refundStatus ?? '')) &&
      b.balanceAmount > 0
    );
  };

  const copyOrderCode = (code: string) => {
    navigator.clipboard?.writeText(code);
    setCopiedId(code);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const allBookings = query.data ?? [];

  // Summary statistics
  const stats = useMemo(() => {
    const totalCount = allBookings.length;
    const needsCollectionList = allBookings.filter(isEligibleForCollection);
    const needsCollectionCount = needsCollectionList.length;
    const needsCollectionAmount = needsCollectionList.reduce(
      (sum, b) => sum + b.balanceAmount,
      0,
    );
    const paidCount = allBookings.filter(
      (b) => b.paymentStatus === 'paid',
    ).length;
    const totalGuests = allBookings
      .filter((b) => b.reservationStatus !== 'cancelled')
      .reduce((sum, b) => sum + b.quantity, 0);

    const workshops = Array.from(
      new Set(allBookings.map((b) => b.workshopTitle).filter(Boolean)),
    ).sort();

    return {
      totalCount,
      needsCollectionCount,
      needsCollectionAmount,
      paidCount,
      totalGuests,
      workshops,
    };
  }, [allBookings]);

  // Filtered bookings
  const filteredBookings = useMemo(() => {
    return allBookings.filter((booking) => {
      // Tab filter
      if (
        activeTab === 'needs_collection' &&
        !isEligibleForCollection(booking)
      ) {
        return false;
      }
      if (activeTab === 'paid' && booking.paymentStatus !== 'paid') {
        return false;
      }
      if (activeTab === 'reschedule' && !booking.reschedulePending) {
        return false;
      }
      if (
        activeTab === 'cancelled' &&
        booking.reservationStatus !== 'cancelled' &&
        booking.paymentStatus !== 'refund_needed' &&
        !['pending', 'refunded'].includes(booking.refundStatus ?? '')
      ) {
        return false;
      }

      // Workshop filter
      if (
        selectedWorkshop !== 'all' &&
        booking.workshopTitle !== selectedWorkshop
      ) {
        return false;
      }

      // Search term
      if (searchTerm.trim()) {
        const needle = searchTerm.trim().toLowerCase();
        const matchCode = booking.orderCode.toLowerCase().includes(needle);
        const matchName = booking.contactName.toLowerCase().includes(needle);
        const matchPhone = (booking.contactPhone ?? '')
          .toLowerCase()
          .includes(needle);
        const matchTitle = booking.workshopTitle.toLowerCase().includes(needle);
        if (!matchCode && !matchName && !matchPhone && !matchTitle) {
          return false;
        }
      }

      return true;
    });
  }, [allBookings, activeTab, selectedWorkshop, searchTerm]);

  if (query.isPending) {
    return (
      <div className="space-y-studio-card" aria-label="Đang tải đặt chỗ">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((item) => (
            <StudioSkeleton
              key={item}
              label="Đang tải số liệu…"
              className="h-24 animate-pulse rounded-studio-card"
            />
          ))}
        </div>
        {[0, 1, 2].map((item) => (
          <StudioSkeleton
            key={item}
            label="Đang tải đặt chỗ…"
            className="h-32 animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (query.isError) {
    return (
      <StudioCard className="space-y-4" role="alert">
        <p className="text-studio-danger">
          Không thể tải đặt chỗ: {query.error.message}
        </p>
        <StudioButton onClick={() => void query.refetch()} variant="secondary">
          Thử tải lại
        </StudioButton>
      </StudioCard>
    );
  }

  return (
    <section aria-label="Quản lý đặt chỗ" className="space-y-studio-section">
      {/* Refund and Attendance operations */}
      <StudioRefundPanel
        studioId={studioId}
        bookings={query.data}
        updated={() => client.invalidateQueries({ queryKey: key })}
      />
      <StudioAttendancePanel
        studioId={studioId}
        bookings={query.data}
        onUpdated={() => client.invalidateQueries({ queryKey: key })}
      />

      {/* KPI Stats Cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-studio-card border border-studio-border bg-studio-surface p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wide text-studio-muted">
              Tổng đặt chỗ
            </span>
            <div className="flex size-8 items-center justify-center rounded-full bg-studio-subtle text-studio-muted">
              <ClipboardList className="size-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-studio-ink">
            {stats.totalCount}
          </p>
          <p className="mt-1 text-xs text-studio-muted">Đơn đặt qua hệ thống</p>
        </div>

        <div className="rounded-studio-card border border-amber-200/80 bg-amber-50/50 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wide text-amber-900">
              Cần thu tại xưởng
            </span>
            <div className="flex size-8 items-center justify-center rounded-full bg-amber-100 text-amber-700">
              <Coins className="size-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-amber-900">
            {stats.needsCollectionCount}{' '}
            <span className="text-sm font-normal text-amber-700">đơn</span>
          </p>
          <p className="mt-1 text-xs font-semibold text-amber-800">
            Còn phải thu {formatPrice(stats.needsCollectionAmount)} đ
          </p>
        </div>

        <div className="rounded-studio-card border border-emerald-200/80 bg-emerald-50/50 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wide text-emerald-900">
              Đã thanh toán đủ
            </span>
            <div className="flex size-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
              <CheckCircle2 className="size-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-emerald-900">
            {stats.paidCount}{' '}
            <span className="text-sm font-normal text-emerald-700">đơn</span>
          </p>
          <p className="mt-1 text-xs text-emerald-700">Hoàn tất 100% tiền</p>
        </div>

        <div className="rounded-studio-card border border-studio-border bg-studio-surface p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wide text-studio-muted">
              Khách tham gia
            </span>
            <div className="flex size-8 items-center justify-center rounded-full bg-studio-subtle text-studio-muted">
              <UsersRound className="size-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-studio-ink">
            {stats.totalGuests}{' '}
            <span className="text-sm font-normal text-studio-muted">người</span>
          </p>
          <p className="mt-1 text-xs text-studio-muted">Tổng số lượng vé đặt</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="space-y-3 rounded-studio-card border border-studio-border bg-studio-surface p-4 shadow-studio-card">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-studio-muted" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm theo mã đơn (#BK...), tên khách, SĐT, workshop..."
              className="w-full rounded-md border border-studio-border bg-studio-subtle/50 py-2 pl-9 pr-9 text-sm text-studio-ink placeholder:text-studio-muted focus:border-studio-primary focus:bg-studio-surface focus:outline-none focus:ring-1 focus:ring-studio-primary"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-studio-muted hover:text-studio-ink"
                title="Xóa tìm kiếm"
              >
                <X className="size-4" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {stats.workshops.length > 1 && (
              <select
                value={selectedWorkshop}
                onChange={(e) => setSelectedWorkshop(e.target.value)}
                className="h-9 rounded-md border border-studio-border bg-studio-surface px-3 text-sm text-studio-ink focus:border-studio-primary focus:outline-none focus:ring-1 focus:ring-studio-primary"
              >
                <option value="all">
                  Tất cả workshop ({stats.workshops.length})
                </option>
                {stats.workshops.map((title) => (
                  <option key={title} value={title}>
                    {title}
                  </option>
                ))}
              </select>
            )}

            <StudioButton
              onClick={() => void query.refetch()}
              type="button"
              variant="secondary"
              className="h-9 shrink-0"
            >
              <RefreshCw
                aria-hidden="true"
                className={`size-4 ${query.isFetching ? 'animate-spin' : ''}`}
              />
              Cập nhật
            </StudioButton>
          </div>
        </div>

        {/* Tab Pills */}
        <div className="flex flex-wrap items-center gap-1.5 border-t border-studio-border/60 pt-3">
          <button
            type="button"
            onClick={() => setActiveTab('all')}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
              activeTab === 'all'
                ? 'bg-studio-primary text-white shadow-xs'
                : 'bg-studio-subtle text-studio-muted hover:bg-studio-border/60 hover:text-studio-ink'
            }`}
          >
            Tất cả
            <span
              className={`rounded-full px-1.5 py-0.2 text-[10px] ${
                activeTab === 'all'
                  ? 'bg-white/20 text-white'
                  : 'bg-studio-border text-studio-ink'
              }`}
            >
              {allBookings.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('needs_collection')}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
              activeTab === 'needs_collection'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
            }`}
          >
            Cần thu tiền tại xưởng
            {stats.needsCollectionCount > 0 && (
              <span
                className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                  activeTab === 'needs_collection'
                    ? 'bg-white text-amber-800'
                    : 'bg-amber-200 text-amber-900'
                }`}
              >
                {stats.needsCollectionCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('paid')}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
              activeTab === 'paid'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
            }`}
          >
            Đã thanh toán đủ
            <span
              className={`rounded-full px-1.5 py-0.2 text-[10px] ${
                activeTab === 'paid'
                  ? 'bg-white/20 text-white'
                  : 'bg-emerald-200 text-emerald-900'
              }`}
            >
              {stats.paidCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('reschedule')}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
              activeTab === 'reschedule'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-studio-subtle text-studio-muted hover:bg-studio-border/60 hover:text-studio-ink'
            }`}
          >
            Chờ dời giờ
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('cancelled')}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
              activeTab === 'cancelled'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-studio-subtle text-studio-muted hover:bg-studio-border/60 hover:text-studio-ink'
            }`}
          >
            Đã hủy / Hoàn tiền
          </button>

          {(searchTerm ||
            activeTab !== 'all' ||
            selectedWorkshop !== 'all') && (
            <button
              type="button"
              onClick={() => {
                setSearchTerm('');
                setActiveTab('all');
                setSelectedWorkshop('all');
              }}
              className="ml-auto inline-flex items-center gap-1 text-xs text-studio-muted underline hover:text-studio-ink"
            >
              <X className="size-3" />
              Đặt lại bộ lọc
            </button>
          )}
        </div>
      </div>

      {/* Bookings Display */}
      {!allBookings.length ? (
        <StudioEmptyState
          icon={ClipboardList}
          title="Chưa có đặt chỗ nào"
          description="Khi khách đặt workshop, thông tin đơn và trạng thái thanh toán sẽ hiển thị tại đây."
        />
      ) : !filteredBookings.length ? (
        <StudioCard className="py-12 text-center">
          <p className="text-base font-medium text-studio-ink">
            Không tìm thấy đặt chỗ phù hợp với điều kiện tìm kiếm.
          </p>
          <p className="mt-1 text-sm text-studio-muted">
            Vui lòng thử thay đổi từ khóa hoặc bộ lọc trạng thái.
          </p>
          <StudioButton
            type="button"
            variant="secondary"
            className="mt-4"
            onClick={() => {
              setSearchTerm('');
              setActiveTab('all');
              setSelectedWorkshop('all');
            }}
          >
            Hiển thị tất cả đặt chỗ
          </StudioButton>
        </StudioCard>
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="hidden overflow-hidden rounded-studio-card border border-studio-border bg-studio-surface shadow-studio-card md:block">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1080px] table-fixed border-collapse text-left">
                <colgroup>
                  <col className="w-[17%]" />
                  <col className="w-[14%]" />
                  <col className="w-[18%]" />
                  <col className="w-[8%]" />
                  <col className="w-[18%]" />
                  <col className="w-[13%]" />
                  <col className="w-[12%]" />
                </colgroup>
                <thead className="border-b border-studio-border bg-studio-subtle text-xs font-semibold uppercase tracking-wider text-studio-muted">
                  <tr>
                    <th className="px-4 py-3.5">Mã đơn / Workshop</th>
                    <th className="px-3 py-3.5">Khách hàng</th>
                    <th className="px-3 py-3.5">Thời gian buổi học</th>
                    <th className="px-2 py-3.5 text-center">Số người</th>
                    <th className="px-3 py-3.5">Thanh toán & Thu tiền</th>
                    <th className="px-3 py-3.5">Trạng thái</th>
                    <th className="px-4 py-3.5 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-studio-border/70 text-sm">
                  {filteredBookings.map((booking) => {
                    const needsCollection = isEligibleForCollection(booking);
                    const remainingBalance = Math.max(
                      0,
                      booking.totalAmount -
                        Math.max(booking.paidAmount, booking.depositAmount),
                    );

                    return (
                      <tr
                        key={booking.id}
                        className={`transition-colors duration-150 hover:bg-studio-selected/50 ${
                          needsCollection ? 'bg-amber-50/20' : ''
                        }`}
                      >
                        <td className="px-4 py-4 align-top">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-studio-ink">
                              #{booking.orderCode}
                            </span>
                            <button
                              type="button"
                              onClick={() => copyOrderCode(booking.orderCode)}
                              className="text-studio-muted hover:text-studio-ink"
                              title="Sao chép mã đơn"
                            >
                              {copiedId === booking.orderCode ? (
                                <Check className="size-3.5 text-emerald-600" />
                              ) : (
                                <Copy className="size-3.5" />
                              )}
                            </button>
                          </div>
                          <p
                            className="mt-1 line-clamp-2 text-xs font-medium text-studio-muted"
                            title={booking.workshopTitle}
                          >
                            {booking.workshopTitle}
                          </p>
                        </td>

                        <td className="px-3 py-4 align-top">
                          <p className="font-semibold text-studio-ink">
                            {booking.contactName}
                          </p>
                          {booking.contactPhone ? (
                            <a
                              href={`tel:${booking.contactPhone}`}
                              className="mt-1 inline-flex items-center gap-1 text-xs text-studio-muted hover:text-studio-primary hover:underline"
                            >
                              <Phone className="size-3" />
                              {booking.contactPhone}
                            </a>
                          ) : (
                            <span className="mt-1 block text-xs text-studio-muted/70">
                              Chưa có SĐT
                            </span>
                          )}
                        </td>

                        <td className="px-3 py-4 align-top">
                          <span className="inline-flex items-start gap-1.5 text-xs text-studio-ink">
                            <CalendarClock
                              aria-hidden="true"
                              className="mt-0.5 size-4 shrink-0 text-studio-muted"
                            />
                            <time dateTime={booking.startsAt}>
                              {dateLabel(booking.startsAt)}
                            </time>
                          </span>
                        </td>

                        <td className="px-2 py-4 text-center align-top">
                          <span className="inline-flex items-center justify-center gap-1 text-sm font-semibold tabular-nums text-studio-ink">
                            <UsersRound
                              aria-hidden="true"
                              className="size-3.5 text-studio-muted"
                            />
                            {booking.quantity}
                          </span>
                        </td>

                        <td className="px-3 py-4 align-top">
                          <p className="font-semibold tabular-nums text-studio-ink">
                            {formatPrice(booking.totalAmount)} đ
                          </p>
                          {booking.paymentMode === 'payos_deposit' ? (
                            <div className="mt-1 space-y-0.5 text-xs text-studio-muted">
                              <p className="tabular-nums">
                                Cọc PayOS:{' '}
                                <span className="font-medium text-studio-ink">
                                  {formatPrice(booking.depositAmount)} đ
                                </span>{' '}
                                ·{' '}
                                {booking.paidAmount >= booking.depositAmount ? (
                                  <span className="text-emerald-700 font-medium">
                                    Đã nhận cọc
                                  </span>
                                ) : (
                                  <span className="text-amber-700 font-medium">
                                    Chờ khách cọc
                                  </span>
                                )}
                              </p>
                              <p className="tabular-nums">
                                Thu tại xưởng:{' '}
                                <span
                                  className={`font-semibold ${
                                    remainingBalance > 0 &&
                                    booking.paymentStatus === 'pending'
                                      ? 'text-amber-800'
                                      : 'text-studio-ink'
                                  }`}
                                >
                                  {formatPrice(remainingBalance)} đ
                                </span>
                              </p>
                            </div>
                          ) : (
                            <p className="mt-1 text-xs text-studio-muted">
                              Thu toàn bộ tại xưởng
                            </p>
                          )}
                        </td>

                        <td className="px-3 py-4 align-top">
                          <div className="flex flex-col items-start gap-1.5">
                            <StudioBadge
                              tone={reservationTone(booking.reservationStatus)}
                            >
                              {booking.reschedulePending
                                ? 'Chờ khách xác nhận giờ mới'
                                : reservationLabel(booking.reservationStatus)}
                            </StudioBadge>
                            <StudioBadge
                              tone={paymentTone(booking.paymentStatus)}
                            >
                              {paymentLabel(booking.paymentStatus)}
                            </StudioBadge>
                          </div>
                        </td>

                        <td className="px-4 py-4 text-right align-top">
                          {needsCollection ? (
                            <StudioButton
                              aria-label={`Ghi nhận thu ${formatPrice(booking.balanceAmount)} đồng cho đơn #${booking.orderCode}`}
                              disabled={payment.isPending}
                              onClick={() => {
                                payment.reset();
                                setSelected(booking);
                              }}
                              type="button"
                              variant="secondary"
                              className="border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100"
                            >
                              Ghi nhận
                            </StudioButton>
                          ) : (
                            <span className="text-sm text-studio-muted">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Card View */}
          <ul className="space-y-3 md:hidden">
            {filteredBookings.map((booking) => {
              const needsCollection = isEligibleForCollection(booking);
              const remainingBalance = Math.max(
                0,
                booking.totalAmount -
                  Math.max(booking.paidAmount, booking.depositAmount),
              );

              return (
                <li key={booking.id}>
                  <StudioCard
                    className={`space-y-3.5 transition-colors duration-150 ${
                      needsCollection ? 'border-amber-200 bg-amber-50/15' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 border-b border-studio-border/60 pb-3">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-bold text-studio-primary">
                            #{booking.orderCode}
                          </span>
                          <button
                            type="button"
                            onClick={() => copyOrderCode(booking.orderCode)}
                            className="text-studio-muted"
                          >
                            {copiedId === booking.orderCode ? (
                              <Check className="size-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="size-3.5" />
                            )}
                          </button>
                        </div>
                        <h2 className="mt-1 font-heading text-base font-semibold text-studio-ink">
                          {booking.workshopTitle}
                        </h2>
                      </div>
                      <p className="shrink-0 text-right font-bold tabular-nums text-studio-ink">
                        {formatPrice(booking.totalAmount)} đ
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-studio-muted">Khách hàng:</span>
                        <p className="font-semibold text-studio-ink">
                          {booking.contactName}
                        </p>
                        {booking.contactPhone && (
                          <a
                            href={`tel:${booking.contactPhone}`}
                            className="mt-0.5 inline-flex items-center gap-1 text-studio-primary"
                          >
                            <Phone className="size-3" />
                            {booking.contactPhone}
                          </a>
                        )}
                      </div>

                      <div>
                        <span className="text-studio-muted">Buổi học:</span>
                        <time
                          className="mt-0.5 block font-medium text-studio-ink"
                          dateTime={booking.startsAt}
                        >
                          {dateLabel(booking.startsAt)}
                        </time>
                      </div>

                      <div>
                        <span className="text-studio-muted">Số người:</span>
                        <p className="font-medium tabular-nums text-studio-ink">
                          {booking.quantity} người
                        </p>
                      </div>

                      <div>
                        <span className="text-studio-muted">
                          {booking.paymentMode === 'payos_deposit'
                            ? 'Cọc PayOS:'
                            : 'Hình thức:'}
                        </span>
                        <p className="font-medium tabular-nums text-studio-ink">
                          {booking.paymentMode === 'payos_deposit'
                            ? `${formatPrice(booking.depositAmount)} đ (${booking.paidAmount >= booking.depositAmount ? 'Đã nhận' : 'Chờ'})`
                            : 'Tại xưởng'}
                        </p>
                      </div>

                      {booking.paymentMode === 'payos_deposit' && (
                        <div className="col-span-2 rounded-md bg-amber-50/70 p-2 border border-amber-200/60">
                          <span className="text-amber-900">
                            Còn lại thu tại xưởng:
                          </span>
                          <span className="float-right font-bold tabular-nums text-amber-900">
                            {formatPrice(remainingBalance)} đ
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2 pt-1">
                      <StudioBadge
                        tone={reservationTone(booking.reservationStatus)}
                      >
                        {booking.reschedulePending
                          ? 'Chờ khách xác nhận giờ mới'
                          : reservationLabel(booking.reservationStatus)}
                      </StudioBadge>
                      <StudioBadge tone={paymentTone(booking.paymentStatus)}>
                        {paymentLabel(booking.paymentStatus)}
                      </StudioBadge>
                    </div>

                    {needsCollection && (
                      <StudioButton
                        className="w-full border-amber-300 bg-amber-100 text-amber-950 hover:bg-amber-200"
                        disabled={payment.isPending}
                        onClick={() => {
                          payment.reset();
                          setSelected(booking);
                        }}
                        type="button"
                        variant="secondary"
                      >
                        Ghi nhận thu {formatPrice(booking.balanceAmount)} đ
                      </StudioButton>
                    )}
                  </StudioCard>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {/* Confirmation Modal */}
      <Dialog
        open={Boolean(selected)}
        onOpenChange={(open) => {
          if (!open && !payment.isPending) setSelected(null);
        }}
      >
        {selected && (
          <DialogContent
            closeDisabled={payment.isPending}
            className="space-y-4 border-studio-border bg-studio-surface text-studio-ink sm:max-w-md"
          >
            <DialogTitle className="font-heading text-xl font-semibold">
              Xác nhận đã nhận tiền đơn #{selected.orderCode}
            </DialogTitle>
            <DialogDescription className="text-sm leading-6 text-studio-muted">
              Đã nhận đủ {formatPrice(selected.balanceAmount)} đ từ{' '}
              {selected.contactName}?
            </DialogDescription>
            {payment.isError && (
              <p role="alert" className="text-sm text-studio-danger">
                {payment.error.message}
              </p>
            )}
            <div className="flex flex-wrap justify-end gap-3 pt-2">
              <StudioButton
                variant="secondary"
                disabled={payment.isPending}
                onClick={() => setSelected(null)}
              >
                Đóng
              </StudioButton>
              <StudioButton
                disabled={payment.isPending}
                onClick={() => payment.mutate(selected)}
                loading={payment.isPending}
              >
                {payment.isPending ? 'Đang ghi nhận…' : 'Đã nhận đủ tiền'}
              </StudioButton>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </section>
  );
}
