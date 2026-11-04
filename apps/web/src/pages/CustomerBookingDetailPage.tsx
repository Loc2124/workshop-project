import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../hooks/useAuth';
import { queryKeys } from '../lib/query-keys';
import { formatPrice } from '../lib/format';
import { customerBookingService } from '../services/customerBookingService';
import { PageContainer } from '../components/layout/PageContainer';
import { LoadingState } from '../components/ui/LoadingState';
import {
  dateLabel,
  paymentLabel,
  reservationLabel,
} from './CustomerBookingsPage';

export function CustomerBookingDetailPage() {
  const { id = '' } = useParams();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const detailKey = queryKeys.bookings.detail(user?.id, id);
  const listKey = queryKeys.bookings.list(user?.id, { view: 'customer' });
  const query = useQuery({
    queryKey: detailKey,
    queryFn: async ({ signal }) => {
      const [booking, tickets] = await Promise.all([
        customerBookingService.get(id, signal),
        customerBookingService.tickets(id, signal),
      ]);
      return { booking, tickets };
    },
    enabled: Boolean(user && id),
    refetchInterval: (query) =>
      query.state.data?.booking.reservationStatus === 'pending' ? 5000 : false,
  });
  const cancel = useMutation({
    mutationFn: () => customerBookingService.cancel(id),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: detailKey }),
        queryClient.invalidateQueries({ queryKey: listKey }),
      ]);
      setConfirmingCancel(false);
    },
  });

  if (query.isLoading) {
    return (
      <PageContainer as="main" className="py-8">
        <LoadingState label="Đang tải chi tiết đặt chỗ…" />
      </PageContainer>
    );
  }
  if (query.isError || !query.data) {
    return (
      <PageContainer as="main" className="py-8">
        <h1 className="font-heading text-2xl font-semibold">
          Chưa tải được đặt chỗ
        </h1>
        <p role="alert" className="mt-3 text-sm text-brick">
          {query.error?.message ?? 'Không tìm thấy đặt chỗ.'}
        </p>
        <button
          type="button"
          onClick={() => void query.refetch()}
          className="mt-4 min-h-11 font-semibold text-primary underline"
        >
          Thử tải lại
        </button>
      </PageContainer>
    );
  }

  const { booking, tickets } = query.data;
  const depositPayment = booking.payments.find(
    (payment) => payment.kind === 'deposit',
  );
  const canCancel =
    ['pending', 'confirmed'].includes(booking.reservationStatus) &&
    !['cancelled', 'expired', 'refund_needed'].includes(booking.paymentStatus);

  return (
    <PageContainer as="main" className="py-8 pb-16">
      <Link
        to="/me/bookings"
        className="inline-flex min-h-11 items-center font-semibold text-primary underline-offset-4 hover:underline"
      >
        ← Lịch đặt của tôi
      </Link>
      {searchParams.get('payment') === 'return' && (
        <p role="status" className="mt-4 bg-soft p-4 text-sm">
          Cổng thanh toán đã chuyển bạn về đây. Trạng thái xác nhận được cập
          nhật từ webhook; hãy tải lại sau ít phút nếu vẫn đang chờ.
        </p>
      )}
      {searchParams.get('payment') === 'cancel' && (
        <p role="status" className="mt-4 bg-soft p-4 text-sm">
          Bạn đã rời trang thanh toán. Chỗ giữ sẽ tự hết hạn nếu chưa hoàn tất
          thanh toán.
        </p>
      )}
      <div className="mt-5 grid gap-8 lg:grid-cols-[minmax(0,1.3fr)_minmax(18rem,0.7fr)]">
        <section className="min-w-0">
          <h1 className="font-heading text-3xl font-semibold">
            {booking.workshopTitle}
          </h1>
          <p className="mt-2 text-stone-700">
            {booking.studioName} · {dateLabel(booking.startsAt)}
          </p>
          <div className="mt-6 grid gap-4 bg-surface p-5 sm:grid-cols-2">
            <div>
              <h2 className="font-semibold">Tình trạng đặt chỗ</h2>
              <p className="mt-1">
                {reservationLabel(booking.reservationStatus)}
              </p>
            </div>
            <div>
              <h2 className="font-semibold">Tình trạng thanh toán</h2>
              <p className="mt-1">{paymentLabel(booking.paymentStatus)}</p>
            </div>
            <div>
              <h2 className="font-semibold">Mã đơn</h2>
              <p className="mt-1 tabular-nums">{booking.orderCode}</p>
            </div>
            <div>
              <h2 className="font-semibold">Số người</h2>
              <p className="mt-1">{booking.quantity}</p>
            </div>
            <div>
              <h2 className="font-semibold">Người liên hệ</h2>
              <p className="mt-1">{booking.contactName}</p>
              <p className="text-sm text-stone-700">{booking.contactPhone}</p>
            </div>
            <div>
              <h2 className="font-semibold">Địa điểm</h2>
              <p className="mt-1">{booking.address ?? booking.studioName}</p>
            </div>
          </div>
          <section className="mt-8">
            <h2 className="font-heading text-2xl font-semibold">Vé tham gia</h2>
            {tickets.length ? (
              <ul className="mt-4 grid gap-4 sm:grid-cols-2">
                {tickets.map((ticket) => (
                  <li
                    key={ticket.id}
                    className="flex min-w-0 items-center gap-4 bg-surface p-4"
                  >
                    <QRCodeSVG
                      value={ticket.code}
                      size={128}
                      level="M"
                      title={`Mã QR vé ${ticket.seq}`}
                      className="size-28 shrink-0"
                    />
                    <div className="min-w-0">
                      <h3 className="font-semibold">Vé số {ticket.seq}</h3>
                      <p className="mt-1 break-all text-sm text-stone-700">
                        {ticket.status === 'valid'
                          ? 'Còn hiệu lực'
                          : 'Đã vô hiệu'}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-stone-700">
                Vé sẽ xuất hiện khi chỗ được xác nhận.
              </p>
            )}
          </section>
        </section>
        <aside className="h-fit bg-surface p-5">
          <h2 className="font-heading text-xl font-semibold">Thanh toán</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between gap-3">
              <dt>Tổng tiền</dt>
              <dd className="font-semibold tabular-nums">
                {formatPrice(booking.totalAmount)} đ
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt>Đã thanh toán</dt>
              <dd className="tabular-nums">
                {formatPrice(booking.paidAmount)} đ
              </dd>
            </div>
            <div className="flex justify-between gap-3 font-semibold">
              <dt>Còn phải trả</dt>
              <dd className="tabular-nums">
                {formatPrice(booking.balanceAmount)} đ
              </dd>
            </div>
          </dl>
          {depositPayment?.checkoutUrl &&
            booking.paymentStatus === 'pending' &&
            booking.reservationStatus === 'pending' && (
              <a
                href={depositPayment.checkoutUrl}
                rel="noreferrer"
                className="mt-5 flex min-h-12 items-center justify-center bg-primary px-4 text-center font-semibold text-white hover:bg-primary-hover"
              >
                Tiếp tục thanh toán tiền cọc
              </a>
            )}
          {booking.paymentMode === 'in_studio' && booking.balanceAmount > 0 && (
            <p className="mt-4 text-sm text-stone-700">
              Thanh toán tại studio khi tham gia workshop.
            </p>
          )}
          {booking.paymentMode === 'payos_deposit' &&
            booking.paidAmount >= booking.depositAmount &&
            booking.balanceAmount > 0 && (
              <p className="mt-4 text-sm text-stone-700">
                Studio đã nhận tiền cọc qua cổng thanh toán. Phần còn lại thanh
                toán tại studio.
              </p>
            )}
          {canCancel && (
            <div className="mt-6 border-t border-stone-200 pt-5">
              {confirmingCancel ? (
                <div className="space-y-3">
                  <p className="text-sm text-brick">
                    Hủy sẽ trả chỗ. Khoản đã thanh toán cần được studio hoàn thủ
                    công.
                  </p>
                  <button
                    type="button"
                    disabled={cancel.isPending}
                    onClick={() => cancel.mutate()}
                    className="min-h-11 w-full bg-brick px-4 font-semibold text-white disabled:opacity-60"
                  >
                    {cancel.isPending ? 'Đang hủy…' : 'Xác nhận hủy đặt chỗ'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmingCancel(false)}
                    className="min-h-11 w-full font-semibold text-primary underline"
                  >
                    Giữ đặt chỗ
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmingCancel(true)}
                  className="min-h-11 font-semibold text-brick underline"
                >
                  Hủy đặt chỗ
                </button>
              )}
              {cancel.isError && (
                <p role="alert" className="mt-3 text-sm text-brick">
                  {cancel.error.message}
                </p>
              )}
            </div>
          )}
          <button
            type="button"
            onClick={() => void query.refetch()}
            className="mt-5 min-h-11 w-full font-semibold text-primary underline"
          >
            Cập nhật trạng thái
          </button>
        </aside>
      </div>
    </PageContainer>
  );
}
