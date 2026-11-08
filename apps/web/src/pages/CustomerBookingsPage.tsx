import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../hooks/useAuth';
import { queryKeys } from '../lib/query-keys';
import { formatPrice } from '../lib/format';
import { customerBookingService } from '../services/customerBookingService';
import { useSessionClock } from '../hooks/useSessionClock';
import { PageContainer } from '../components/layout/PageContainer';
import { LoadingState } from '../components/ui/LoadingState';

function dateLabel(value: string) {
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(new Date(value));
}

export function sessionLifecycleLabel(
  startsAt: string,
  endsAt: string,
  recordStatus: string,
  now = Date.now(),
) {
  if (recordStatus === 'cancelled') return 'Đã hủy';
  if (now >= Date.parse(endsAt)) return 'Đã kết thúc';
  if (now >= Date.parse(startsAt)) return 'Đang diễn ra';
  return 'Chưa diễn ra';
}

function paymentLabel(status: string) {
  return (
    {
      pending: 'Chờ thanh toán',
      paid: 'Đã thanh toán',
      cancelled: 'Đã hủy',
      expired: 'Đã hết hạn',
      refund_needed: 'Cần xử lý hoàn tiền',
      failed: 'Thanh toán thất bại',
      processing: 'Đang xử lý',
    }[status] ?? status
  );
}

function reservationLabel(status: string) {
  return (
    {
      pending: 'Đang giữ chỗ',
      confirmed: 'Đã xác nhận',
      cancelled: 'Đã hủy',
      expired: 'Hết hạn giữ chỗ',
    }[status] ?? status
  );
}

export { dateLabel, paymentLabel, reservationLabel };

export function CustomerBookingsPage() {
  const { user } = useAuth();
  const query = useQuery({
    queryKey: queryKeys.bookings.list(user?.id, { view: 'customer' }),
    queryFn: ({ signal }) => customerBookingService.list(signal),
    enabled: Boolean(user),
  });
  const now = useSessionClock(
    (query.data ?? []).map((booking) => ({
      id: booking.id,
      startsAt: booking.startsAt,
      endsAt: booking.endsAt,
      price: 0,
      availableSeats: 0,
    })),
  );

  return (
    <PageContainer as="main" className="py-8 pb-16">
      <h1 className="font-heading text-3xl font-semibold">Lịch đặt của tôi</h1>
      <p className="mt-2 text-sm text-stone-700">
        Theo dõi tình trạng giữ chỗ, thanh toán và vé workshop.
      </p>
      <Link
        to="/me/refund-accounts"
        className="mt-3 inline-flex min-h-10 items-center text-sm font-semibold text-olive underline"
      >
        Quản lý tài khoản nhận hoàn đã lưu
      </Link>
      {query.isLoading ? (
        <LoadingState label="Đang tải lịch đặt…" className="mt-8" />
      ) : query.isError ? (
        <div className="mt-8 space-y-3" role="alert">
          <p>Chưa tải được lịch đặt. {query.error.message}</p>
          <button
            type="button"
            className="min-h-11 font-semibold text-primary underline"
            onClick={() => void query.refetch()}
          >
            Thử tải lại
          </button>
        </div>
      ) : query.data?.length ? (
        <ul className="mt-8 divide-y divide-stone-200">
          {query.data.map((booking) => (
            <li key={booking.id} className="py-5 first:pt-0">
              <Link
                to={`/me/bookings/${booking.id}`}
                className="block rounded-xl bg-surface p-4 transition-colors hover:bg-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:p-6"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h2 className="font-heading text-xl font-semibold">
                      {booking.workshopTitle}
                    </h2>
                    <p className="mt-1 text-sm text-stone-700">
                      {booking.studioName} · {dateLabel(booking.startsAt)}
                    </p>
                  </div>
                  <span className="font-semibold tabular-nums">
                    {formatPrice(booking.totalAmount)} đ
                  </span>
                </div>
                <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm">
                  <span>{reservationLabel(booking.reservationStatus)}</span>
                  <span>{paymentLabel(booking.paymentStatus)}</span>
                  <span>
                    Buổi học:{' '}
                    {sessionLifecycleLabel(
                      booking.startsAt,
                      booking.endsAt,
                      booking.sessionRecordStatus,
                      now,
                    )}
                  </span>
                  {booking.balanceAmount > 0 && (
                    <span>Còn {formatPrice(booking.balanceAmount)} đ</span>
                  )}
                  <span>Mã đơn {booking.orderCode}</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <section className="mt-8 bg-surface px-5 py-10 text-center">
          <h2 className="font-heading text-xl font-semibold">
            Bạn chưa có đặt chỗ nào
          </h2>
          <p className="mt-2 text-sm text-stone-700">
            Chọn một buổi workshop để bắt đầu trải nghiệm.
          </p>
          <Link
            to="/kham-pha"
            className="mt-5 inline-flex min-h-11 items-center bg-primary px-5 font-semibold text-white hover:bg-primary-hover"
          >
            Khám phá workshop
          </Link>
        </section>
      )}
    </PageContainer>
  );
}
