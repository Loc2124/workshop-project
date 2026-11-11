import { useState } from 'react';
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
  ClipboardList,
  RefreshCw,
  UsersRound,
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

export function StudioBookingManager({ studioId }: { studioId: string }) {
  const { user } = useAuth();
  const client = useQueryClient();
  const key = queryKeys.bookings.forStudio(user?.id, studioId);
  const [selected, setSelected] = useState<Booking | null>(null);
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
    if (status === 'confirmed') return 'success' as const;
    if (status === 'pending') return 'warning' as const;
    if (status === 'cancelled') return 'danger' as const;
    return 'neutral' as const;
  };

  if (query.isPending)
    return (
      <div className="space-y-studio-card" aria-label="Đang tải đặt chỗ">
        {[0, 1, 2].map((item) => (
          <StudioSkeleton
            key={item}
            label="Đang tải đặt chỗ…"
            className="h-32 animate-pulse"
          />
        ))}
      </div>
    );
  if (query.isError)
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
  return (
    <section aria-label="Quản lý đặt chỗ" className="space-y-studio-section">
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
      <div className="flex flex-col gap-4 rounded-studio-card border border-studio-border bg-studio-surface p-studio-card shadow-studio-card sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm leading-6 text-studio-muted">
            Chỉ xác nhận thu tiền sau khi đã nhận đủ khoản còn lại từ khách.
            Hiển thị tối đa 200 đơn gần nhất.
          </p>
          <p className="mt-2 text-sm font-medium text-studio-primary">
            {query.data.length} đặt chỗ
          </p>
        </div>
        <StudioButton
          onClick={() => void query.refetch()}
          type="button"
          variant="secondary"
        >
          <RefreshCw
            aria-hidden="true"
            className={`size-4 ${query.isFetching ? 'animate-spin' : ''}`}
          />
          Cập nhật
        </StudioButton>
      </div>

      {!query.data.length ? (
        <StudioEmptyState
          icon={ClipboardList}
          title="Chưa có đặt chỗ nào"
          description="Khi khách đặt workshop, thông tin đơn và trạng thái thanh toán sẽ hiển thị tại đây."
        />
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-studio-card border border-studio-border bg-studio-surface shadow-studio-card md:block">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1080px] table-fixed border-collapse text-left">
                <colgroup>
                  <col className="w-[14%]" />
                  <col className="w-[14%]" />
                  <col className="w-[20%]" />
                  <col className="w-[9%]" />
                  <col className="w-[13%]" />
                  <col className="w-[16%]" />
                  <col className="w-[14%]" />
                </colgroup>
                <thead className="bg-studio-subtle text-xs font-semibold uppercase tracking-wide text-studio-muted">
                  <tr>
                    <th className="whitespace-nowrap px-3 py-4">
                      Mã đơn / Workshop
                    </th>
                    <th className="whitespace-nowrap px-2 py-4">Khách</th>
                    <th className="whitespace-nowrap px-2 py-4">Thời gian</th>
                    <th className="whitespace-nowrap px-2 py-4 text-center">
                      Số người
                    </th>
                    <th className="whitespace-nowrap px-2 py-4">Số tiền</th>
                    <th className="whitespace-nowrap px-2 py-4">Trạng thái</th>
                    <th className="whitespace-nowrap px-3 py-4 text-right">
                      Thao tác
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-studio-border">
                  {query.data.map((booking) => (
                    <tr
                      key={booking.id}
                      className="transition-colors duration-150 hover:bg-studio-selected/60"
                    >
                      <td className="max-w-60 px-3 py-4">
                        <p className="font-semibold text-studio-ink">
                          #{booking.orderCode}
                        </p>
                        <p
                          className="mt-1 truncate text-sm text-studio-muted"
                          title={booking.workshopTitle}
                        >
                          {booking.workshopTitle}
                        </p>
                      </td>
                      <td className="max-w-52 px-2 py-4">
                        <p className="font-medium text-studio-ink">
                          {booking.contactName}
                        </p>
                        <p className="mt-1 text-sm text-studio-muted">
                          {booking.contactPhone ?? 'Chưa có số điện thoại'}
                        </p>
                      </td>
                      <td className="min-w-56 px-2 py-4 text-sm text-studio-muted">
                        <span className="inline-flex items-start gap-2">
                          <CalendarClock
                            aria-hidden="true"
                            className="mt-0.5 size-4 shrink-0"
                          />
                          <time dateTime={booking.startsAt}>
                            {dateLabel(booking.startsAt)}
                          </time>
                        </span>
                      </td>
                      <td className="px-2 py-4 text-center">
                        <span className="inline-flex items-center justify-center gap-1.5 text-sm tabular-nums text-studio-ink">
                          <UsersRound
                            aria-hidden="true"
                            className="size-4 text-studio-muted"
                          />
                          {booking.quantity}
                        </span>
                      </td>
                      <td className="min-w-44 px-2 py-4">
                        <p className="font-semibold tabular-nums text-studio-ink">
                          {formatPrice(booking.totalAmount)} đ
                        </p>
                        {booking.paymentMode === 'payos_deposit' ? (
                          <div className="mt-1 space-y-1 text-sm text-studio-muted">
                            <p className="tabular-nums">
                              Đặt cọc: {formatPrice(booking.depositAmount)} đ ·{' '}
                              {booking.paidAmount >= booking.depositAmount
                                ? 'đã thanh toán'
                                : 'chờ khách thanh toán'}
                            </p>
                            <p className="tabular-nums">
                              Còn lại tại studio:{' '}
                              {formatPrice(
                                Math.max(
                                  0,
                                  booking.totalAmount -
                                    Math.max(
                                      booking.paidAmount,
                                      booking.depositAmount,
                                    ),
                                ),
                              )}{' '}
                              đ
                            </p>
                          </div>
                        ) : (
                          <p className="mt-1 text-sm tabular-nums text-studio-muted">
                            Khách thanh toán tại studio
                          </p>
                        )}
                      </td>
                      <td className="min-w-48 px-2 py-4">
                        <div className="flex flex-col items-start gap-2">
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
                      <td className="px-3 py-4 text-right">
                        {['confirmed', 'completed'].includes(
                          booking.reservationStatus,
                        ) &&
                        booking.paymentStatus === 'pending' &&
                        !booking.reschedulePending &&
                        ((booking.seatRevision ?? 0) > 0 ||
                          !['pending', 'refunded'].includes(
                            booking.refundStatus ?? '',
                          )) &&
                        booking.balanceAmount > 0 ? (
                          <StudioButton
                            aria-label={`Ghi nhận thu ${formatPrice(booking.balanceAmount)} đồng cho đơn #${booking.orderCode}`}
                            disabled={payment.isPending}
                            onClick={() => {
                              payment.reset();
                              setSelected(booking);
                            }}
                            type="button"
                            variant="secondary"
                          >
                            Ghi nhận
                          </StudioButton>
                        ) : (
                          <span className="text-sm text-studio-muted">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <ul className="space-y-studio-card md:hidden">
            {query.data.map((booking) => (
              <li key={booking.id}>
                <StudioCard className="space-y-4 transition-colors duration-150 hover:border-studio-primary/30">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-studio-primary">
                        #{booking.orderCode}
                      </p>
                      <h2 className="mt-1 font-heading text-lg font-semibold leading-snug text-studio-ink">
                        {booking.workshopTitle}
                      </h2>
                    </div>
                    <p className="shrink-0 text-right font-semibold tabular-nums text-studio-ink">
                      {formatPrice(booking.totalAmount)} đ
                    </p>
                  </div>
                  <div className="grid gap-3 border-y border-studio-border py-3 text-sm sm:grid-cols-2">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-studio-muted">
                        Khách
                      </p>
                      <p className="mt-1 font-medium text-studio-ink">
                        {booking.contactName}
                      </p>
                      <p className="mt-0.5 text-studio-muted">
                        {booking.contactPhone ?? 'Chưa có số điện thoại'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-studio-muted">
                        Thời gian
                      </p>
                      <time
                        className="mt-1 block text-studio-ink"
                        dateTime={booking.startsAt}
                      >
                        {dateLabel(booking.startsAt)}
                      </time>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-studio-muted">Số người</span>
                      <span className="inline-flex items-center gap-1.5 font-medium tabular-nums text-studio-ink">
                        <UsersRound
                          aria-hidden="true"
                          className="size-4 text-studio-muted"
                        />
                        {booking.quantity}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-studio-muted">
                        {booking.paymentMode === 'payos_deposit'
                          ? `Đặt cọc (${booking.depositAmount > 0 && booking.paidAmount >= booking.depositAmount ? 'đã trả' : 'đang chờ'})`
                          : 'Thanh toán'}
                      </span>
                      <span className="font-medium tabular-nums text-studio-ink">
                        {formatPrice(
                          booking.paymentMode === 'payos_deposit'
                            ? booking.depositAmount
                            : booking.totalAmount,
                        )}{' '}
                        đ
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3 sm:col-span-2">
                      <span className="text-studio-muted">
                        {booking.paymentMode === 'payos_deposit'
                          ? 'Còn lại tại studio'
                          : 'Hình thức thu'}
                      </span>
                      <span className="font-medium tabular-nums text-studio-ink">
                        {booking.paymentMode === 'payos_deposit'
                          ? `${formatPrice(Math.max(0, booking.totalAmount - Math.max(booking.paidAmount, booking.depositAmount)))} đ`
                          : 'Thu toàn bộ tại studio'}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
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
                  {['confirmed', 'completed'].includes(
                    booking.reservationStatus,
                  ) &&
                    booking.paymentStatus === 'pending' &&
                    !booking.reschedulePending &&
                    ((booking.seatRevision ?? 0) > 0 ||
                      !['pending', 'refunded'].includes(
                        booking.refundStatus ?? '',
                      )) &&
                    booking.balanceAmount > 0 && (
                      <StudioButton
                        className="w-full"
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
            ))}
          </ul>
        </>
      )}
      <Dialog
        open={Boolean(selected)}
        onOpenChange={(open) => {
          if (!open && !payment.isPending) setSelected(null);
        }}
      >
        {selected && (
          <DialogContent
            closeDisabled={payment.isPending}
            className="space-y-4 border-studio-border bg-studio-surface text-studio-ink"
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
            <div className="flex flex-wrap justify-end gap-3">
              <StudioButton
                disabled={payment.isPending}
                onClick={() => payment.mutate(selected)}
                loading={payment.isPending}
              >
                {payment.isPending ? 'Đang ghi nhận…' : 'Đã nhận đủ tiền'}
              </StudioButton>
              <StudioButton
                variant="secondary"
                disabled={payment.isPending}
                onClick={() => setSelected(null)}
              >
                Đóng
              </StudioButton>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </section>
  );
}
