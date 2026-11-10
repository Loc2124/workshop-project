import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Copy } from 'lucide-react';
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
      completed: 'Đã thanh toán',
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
      completed: 'Đã hoàn tất',
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
  const [tab, setTab] = useState<'upcoming' | 'past' | 'cancelled'>('upcoming');
  const [copiedOrder, setCopiedOrder] = useState<string | null>(null);
  const bookings = query.data ?? [];
  const cancelled = (booking: (typeof bookings)[number]) =>
    ['cancelled', 'expired'].includes(booking.reservationStatus) ||
    booking.sessionRecordStatus === 'cancelled';
  const visibleBookings = bookings.filter((booking) => {
    if (tab === 'cancelled') return cancelled(booking);
    if (cancelled(booking)) return false;
    return tab === 'upcoming'
      ? Date.parse(booking.endsAt) > now
      : Date.parse(booking.endsAt) <= now;
  });
  const paymentTone = (status: string) =>
    ['paid', 'completed'].includes(status)
      ? 'bg-[#DCEFC8] text-[#2A4710]'
      : ['pending', 'processing'].includes(status)
        ? 'bg-[#FBE8B5] text-[#7A4B00]'
        : 'bg-[#E8E4D8] text-[#4A453C]';
  const reservationTone = (status: string) =>
    ['cancelled', 'expired'].includes(status)
      ? 'bg-[#E8E4D8] text-[#4A453C]'
      : 'bg-[#DCEFC8] text-[#2A4710]';

  return (
    <PageContainer as="main" className="py-8 pb-16">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <h1 className="font-heading text-3xl font-semibold">
          Lịch đặt của tôi
        </h1>
        <Link
          to="/me/refund-accounts"
          className="inline-flex min-h-11 items-center justify-center rounded-lg border border-primary px-4 text-sm font-semibold text-primary hover:bg-primary hover:text-white"
        >
          Quản lý tài khoản nhận hoàn
        </Link>
      </div>
      <p className="mt-2 text-sm text-stone-700">
        Theo dõi tình trạng giữ chỗ, thanh toán và vé workshop.
      </p>
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
      ) : bookings.length ? (
        <>
          <div aria-label="Lọc lịch đặt" className="mt-7 flex flex-wrap gap-2">
            {(
              [
                ['upcoming', 'Sắp tới'],
                ['past', 'Đã qua'],
                ['cancelled', 'Đã hủy'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={tab === value}
                onClick={() => setTab(value)}
                className={`min-h-10 rounded-full px-4 text-sm font-semibold ${tab === value ? 'bg-primary text-white' : 'bg-soft text-stone-700 hover:bg-stone-200'}`}
              >
                {label}{' '}
                <span className="ml-1 tabular-nums">
                  {
                    bookings.filter((booking) =>
                      value === 'cancelled'
                        ? cancelled(booking)
                        : !cancelled(booking) &&
                          (value === 'upcoming'
                            ? Date.parse(booking.endsAt) > now
                            : Date.parse(booking.endsAt) <= now),
                    ).length
                  }
                </span>
              </button>
            ))}
          </div>
          {visibleBookings.length ? (
            <ul className="mt-5 divide-y divide-stone-200">
              {visibleBookings.map((booking) => (
                <li key={booking.id} className="py-5 first:pt-0">
                  <article className="rounded-xl bg-surface p-4 transition-colors hover:bg-soft sm:p-6">
                    <Link
                      to={`/me/bookings/${booking.id}`}
                      className="block rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
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
                      <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
                        <span
                          className={`rounded-full px-3 py-1 font-semibold ${reservationTone(booking.reservationStatus)}`}
                        >
                          Đặt chỗ ·{' '}
                          {reservationLabel(booking.reservationStatus)}
                        </span>
                        <span
                          className={`rounded-full px-3 py-1 font-semibold ${paymentTone(booking.paymentStatus)}`}
                        >
                          Thanh toán · {paymentLabel(booking.paymentStatus)}
                        </span>
                        <span className="rounded-full bg-stone-100 px-3 py-1 text-stone-700">
                          Buổi học:{' '}
                          {sessionLifecycleLabel(
                            booking.startsAt,
                            booking.endsAt,
                            booking.sessionRecordStatus,
                            now,
                          )}
                        </span>
                        {!cancelled(booking) && booking.balanceAmount > 0 && (
                          <span>
                            Còn {formatPrice(booking.balanceAmount)} đ
                          </span>
                        )}
                      </div>
                    </Link>
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <span className="inline-flex min-h-9 items-center rounded-full bg-stone-100 px-3 text-xs font-semibold text-stone-700">
                        Mã đơn · {booking.orderCode}
                      </span>
                      <button
                        type="button"
                        className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-line px-3 text-xs font-semibold text-stone-700 hover:bg-white"
                        aria-label={`Sao chép mã đơn ${booking.orderCode}`}
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(
                              String(booking.orderCode),
                            );
                            setCopiedOrder(String(booking.orderCode));
                            window.setTimeout(() => setCopiedOrder(null), 1800);
                          } catch {
                            setCopiedOrder(null);
                          }
                        }}
                      >
                        {copiedOrder === String(booking.orderCode) ? (
                          <Check size={14} />
                        ) : (
                          <Copy size={14} />
                        )}
                        {copiedOrder === String(booking.orderCode)
                          ? 'Đã sao chép'
                          : 'Sao chép'}
                      </button>
                      {booking.reservationStatus === 'pending' &&
                      booking.paymentStatus !== 'paid' ? (
                        <Link
                          to={`/me/bookings/${booking.id}`}
                          className="inline-flex min-h-10 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-white hover:bg-primary-hover"
                        >
                          Thanh toán
                        </Link>
                      ) : cancelled(booking) ? (
                        <Link
                          to={`/me/bookings/${booking.id}`}
                          className="inline-flex min-h-10 items-center rounded-lg border border-line px-4 text-sm font-semibold text-ink hover:bg-white"
                        >
                          Xem chi tiết
                        </Link>
                      ) : Date.parse(booking.endsAt) <= now ? (
                        <Link
                          to={`/me/bookings/${booking.id}`}
                          className="inline-flex min-h-10 items-center rounded-lg border border-primary px-4 text-sm font-semibold text-primary hover:bg-primary hover:text-white"
                        >
                          Đặt lại
                        </Link>
                      ) : (
                        <Link
                          to={`/me/bookings/${booking.id}#booking-tickets-title`}
                          className="inline-flex min-h-10 items-center rounded-lg border border-primary px-4 text-sm font-semibold text-primary hover:bg-primary hover:text-white"
                        >
                          Xem vé
                        </Link>
                      )}
                    </div>
                  </article>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-5 rounded-xl bg-surface px-5 py-8 text-center text-sm text-stone-700">
              Chưa có đặt chỗ trong mục này.
            </p>
          )}
        </>
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
