import { useState } from 'react';
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
import { Button } from '../ui/button';
import { LoadingState } from '../ui/LoadingState';
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
      balanceAmount: z.number(),
      reservationStatus: z.string(),
      paymentStatus: z.string(),
      startsAt: z.string(),
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
  if (query.isPending) return <LoadingState label="Đang tải đặt chỗ…" />;
  if (query.isError)
    return (
      <div role="alert">
        <p>{query.error.message}</p>
        <Button onClick={() => void query.refetch()}>Thử lại</Button>
      </div>
    );
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-heading text-lg font-semibold">
          Danh sách đặt chỗ
        </h2>
        <Button variant="outline" onClick={() => void query.refetch()}>
          Cập nhật
        </Button>
      </div>
      <p className="text-sm text-muted">
        Chỉ xác nhận thu tiền sau khi đã nhận đủ khoản còn lại từ khách. Hiển
        thị tối đa 200 đơn gần nhất.
      </p>
      {!query.data.length ? (
        <p className="py-6 text-muted">Studio chưa có đặt chỗ.</p>
      ) : (
        <ul className="divide-y divide-line border-y border-line">
          {query.data.map((booking) => (
            <li
              key={booking.id}
              className="grid gap-3 py-4 md:grid-cols-[minmax(0,1fr)_auto]"
            >
              <div className="min-w-0 space-y-1">
                <h3 className="break-words font-semibold">
                  #{booking.orderCode} · {booking.workshopTitle}
                </h3>
                <p className="text-sm">
                  {dateLabel(booking.startsAt)} · {booking.quantity} người
                </p>
                <p className="break-words text-sm">
                  {booking.contactName} ·{' '}
                  {booking.contactPhone ?? 'Chưa có số điện thoại'}
                </p>
                <p className="text-sm text-muted">
                  {reservationLabel(booking.reservationStatus)} ·{' '}
                  {paymentLabel(booking.paymentStatus)}
                </p>
              </div>
              <div className="space-y-2 md:text-right">
                <p className="text-sm tabular-nums">
                  Đã thu {formatPrice(booking.paidAmount)} đ /{' '}
                  {formatPrice(booking.totalAmount)} đ
                </p>
                {booking.reservationStatus === 'confirmed' &&
                  booking.paymentStatus === 'pending' &&
                  booking.balanceAmount > 0 && (
                    <Button
                      variant="outline"
                      disabled={payment.isPending}
                      onClick={() => {
                        payment.reset();
                        setSelected(booking);
                      }}
                    >
                      Ghi nhận thu {formatPrice(booking.balanceAmount)} đ
                    </Button>
                  )}
              </div>
            </li>
          ))}
        </ul>
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
            className="space-y-4"
          >
            <DialogTitle>
              Xác nhận đã nhận tiền đơn #{selected.orderCode}
            </DialogTitle>
            <DialogDescription>
              Đã nhận đủ {formatPrice(selected.balanceAmount)} đ từ{' '}
              {selected.contactName}?
            </DialogDescription>
            {payment.isError && (
              <p role="alert" className="text-sm text-brick">
                {payment.error.message}
              </p>
            )}
            <div className="flex flex-wrap gap-3">
              <Button
                disabled={payment.isPending}
                onClick={() => payment.mutate(selected)}
              >
                {payment.isPending ? 'Đang ghi nhận…' : 'Đã nhận đủ tiền'}
              </Button>
              <Button
                variant="outline"
                disabled={payment.isPending}
                onClick={() => setSelected(null)}
              >
                Đóng
              </Button>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </section>
  );
}
