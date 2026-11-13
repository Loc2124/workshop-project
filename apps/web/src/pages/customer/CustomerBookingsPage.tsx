import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Check, Copy, Store, Ticket, Wallet } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { queryKeys } from '@/lib/query-keys';
import { formatPrice } from '@/lib/format';
import { customerBookingService } from '@/services/customerBookingService';
import { useSessionClock } from '@/hooks/useSessionClock';
import { PageContainer } from '@/components/layout/PageContainer';
import { LoadingState } from '@/components/ui/LoadingState';

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
      ? 'bg-studio-success-soft text-studio-success'
      : ['pending', 'processing'].includes(status)
        ? 'bg-studio-warning-soft text-studio-warning'
        : ['failed', 'refund_needed'].includes(status)
          ? 'bg-studio-danger-soft text-studio-danger'
          : 'bg-studio-neutral-soft text-studio-neutral';
  const reservationTone = (status: string) =>
    ['cancelled', 'expired'].includes(status)
      ? 'bg-studio-neutral-soft text-studio-neutral'
      : status === 'pending'
        ? 'bg-studio-warning-soft text-studio-warning'
        : 'bg-studio-success-soft text-studio-success';

  const tabCounts = {
    upcoming: bookings.filter(
      (booking) => !cancelled(booking) && Date.parse(booking.endsAt) > now,
    ).length,
    past: bookings.filter(
      (booking) => !cancelled(booking) && Date.parse(booking.endsAt) <= now,
    ).length,
    cancelled: bookings.filter((booking) => cancelled(booking)).length,
  };

  return (
    <PageContainer as="main" className="py-6 pb-16 sm:py-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-ink sm:text-3xl">
            Lịch đặt của tôi
          </h1>
          <p className="mt-1.5 text-sm text-muted">
            Theo dõi tình trạng giữ chỗ, thanh toán và vé tham gia workshop.
          </p>
        </div>
        <Link
          to="/me/refund-accounts"
          className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg border border-line bg-surface px-4 text-sm font-semibold text-ink transition-colors hover:border-primary hover:text-primary"
        >
          <Wallet size={16} aria-hidden="true" />
          Tài khoản nhận hoàn
        </Link>
      </div>
      {query.isLoading ? (
        <LoadingState label="Đang tải lịch đặt…" className="mt-8" />
      ) : query.isError ? (
        <div
          className="mt-8 space-y-3 rounded-xl border border-line bg-surface p-6"
          role="alert"
        >
          <p className="text-sm text-brick">
            Chưa tải được lịch đặt. {query.error.message}
          </p>
          <button
            type="button"
            className="inline-flex min-h-11 items-center rounded-lg border border-primary px-4 text-sm font-semibold text-primary hover:bg-soft"
            onClick={() => void query.refetch()}
          >
            Thử tải lại
          </button>
        </div>
      ) : bookings.length ? (
        <>
          <div
            aria-label="Lọc lịch đặt"
            className="mt-6 flex flex-wrap gap-2 border-b border-line pb-4"
          >
            {(
              [
                ['upcoming', 'Sắp tới'],
                ['past', 'Đã qua'],
                ['cancelled', 'Đã hủy'],
              ] as const
            ).map(([value, label]) => {
              const active = tab === value;
              return (
                <button
                  key={value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setTab(value)}
                  className={`inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-semibold transition-colors ${
                    active
                      ? 'bg-primary text-white shadow-xs'
                      : 'border border-line bg-surface text-stone-700 hover:bg-soft'
                  }`}
                >
                  <span>{label}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs tabular-nums ${
                      active
                        ? 'bg-white/20 text-white'
                        : 'bg-soft text-stone-700'
                    }`}
                  >
                    {tabCounts[value]}
                  </span>
                </button>
              );
            })}
          </div>
          {visibleBookings.length ? (
            <ul className="mt-6 space-y-4">
              {visibleBookings.map((booking) => {
                const isCancelled = cancelled(booking);
                const needsPayment =
                  booking.reservationStatus === 'pending' &&
                  booking.paymentStatus !== 'paid';
                const isPast = Date.parse(booking.endsAt) <= now;
                return (
                  <li key={booking.id}>
                    <article className="relative rounded-xl border border-line bg-surface p-4 transition-colors hover:border-primary/40 hover:bg-paper/70 has-[a.card-link:focus-visible]:outline-2 has-[a.card-link:focus-visible]:outline-offset-2 has-[a.card-link:focus-visible]:outline-primary sm:p-5">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <h2 className="font-heading text-lg font-semibold text-ink sm:text-xl">
                            <Link
                              to={`/me/bookings/${booking.id}`}
                              className="card-link rounded focus-visible:outline-none hover:text-primary"
                            >
                              {booking.workshopTitle}
                            </Link>
                          </h2>
                          <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-stone-700">
                            <span className="inline-flex items-center gap-1.5">
                              <Store
                                size={14}
                                className="shrink-0 text-muted"
                                aria-hidden="true"
                              />
                              {booking.studioName}
                            </span>
                            <span className="inline-flex items-center gap-1.5 tabular-nums">
                              <Calendar
                                size={14}
                                className="shrink-0 text-muted"
                                aria-hidden="true"
                              />
                              {dateLabel(booking.startsAt)}
                            </span>
                          </div>
                        </div>
                        <div className="shrink-0 sm:text-right">
                          <p className="text-base font-semibold tabular-nums text-ink sm:text-lg">
                            {formatPrice(booking.totalAmount)} đ
                          </p>
                          {!isCancelled && booking.balanceAmount > 0 && (
                            <p className="mt-0.5 text-xs font-medium tabular-nums text-muted">
                              Còn {formatPrice(booking.balanceAmount)} đ tại
                              studio
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="mt-3.5 flex flex-wrap items-center gap-2 text-xs">
                        <span
                          className={`rounded-full px-3 py-1 font-semibold ${reservationTone(booking.reservationStatus)}`}
                        >
                          {reservationLabel(booking.reservationStatus)}
                        </span>
                        <span
                          className={`rounded-full px-3 py-1 font-semibold ${paymentTone(booking.paymentStatus)}`}
                        >
                          {paymentLabel(booking.paymentStatus)}
                        </span>
                        <span className="rounded-full bg-soft px-3 py-1 font-medium text-stone-700">
                          Buổi học:{' '}
                          {sessionLifecycleLabel(
                            booking.startsAt,
                            booking.endsAt,
                            booking.sessionRecordStatus,
                            now,
                          )}
                        </span>
                      </div>

                      <footer className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line/70 pt-3.5">
                        <div className="relative z-10 flex flex-wrap items-center gap-2">
                          <span className="inline-flex min-h-9 items-center rounded-md bg-paper px-2.5 font-mono text-xs font-semibold text-stone-700 border border-line/70">
                            #{booking.orderCode}
                          </span>
                          <button
                            type="button"
                            className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-line bg-surface px-3 text-xs font-semibold text-stone-700 transition-colors hover:border-primary/40 hover:bg-soft"
                            aria-label={`Sao chép mã đơn ${booking.orderCode}`}
                            onClick={async () => {
                              try {
                                await navigator.clipboard.writeText(
                                  String(booking.orderCode),
                                );
                                setCopiedOrder(String(booking.orderCode));
                                window.setTimeout(
                                  () => setCopiedOrder(null),
                                  1800,
                                );
                              } catch {
                                setCopiedOrder(null);
                              }
                            }}
                          >
                            {copiedOrder === String(booking.orderCode) ? (
                              <Check
                                size={14}
                                className="text-studio-success"
                                aria-hidden="true"
                              />
                            ) : (
                              <Copy size={14} aria-hidden="true" />
                            )}
                            {copiedOrder === String(booking.orderCode)
                              ? 'Đã sao chép'
                              : 'Sao chép'}
                          </button>
                        </div>

                        <div className="relative z-10 flex items-center gap-2 sm:ml-auto">
                          {needsPayment ? (
                            <Link
                              to={`/me/bookings/${booking.id}`}
                              className="inline-flex min-h-11 items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-white transition-colors hover:bg-primary-hover"
                            >
                              Thanh toán ngay
                            </Link>
                          ) : isCancelled ? (
                            <Link
                              to={`/me/bookings/${booking.id}`}
                              className="inline-flex min-h-11 items-center justify-center rounded-lg border border-line bg-surface px-4 text-sm font-semibold text-ink transition-colors hover:bg-soft"
                            >
                              Xem chi tiết
                            </Link>
                          ) : isPast ? (
                            <Link
                              to={`/me/bookings/${booking.id}`}
                              className="inline-flex min-h-11 items-center justify-center rounded-lg border border-primary px-4 text-sm font-semibold text-primary transition-colors hover:bg-primary hover:text-white"
                            >
                              Xem chi tiết & đặt lại
                            </Link>
                          ) : (
                            <Link
                              to={`/me/bookings/${booking.id}#booking-tickets-title`}
                              className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg border border-primary px-4 text-sm font-semibold text-primary transition-colors hover:bg-primary hover:text-white"
                            >
                              <Ticket size={16} aria-hidden="true" />
                              Xem vé
                            </Link>
                          )}
                        </div>
                      </footer>
                    </article>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="mt-6 rounded-xl border border-dashed border-line bg-surface px-5 py-10 text-center">
              <p className="text-sm text-muted">
                Chưa có đặt chỗ trong mục này.
              </p>
            </div>
          )}
        </>
      ) : (
        <section className="mt-8 rounded-xl border border-line bg-surface px-5 py-12 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-soft text-primary">
            <Ticket size={22} aria-hidden="true" />
          </div>
          <h2 className="mt-4 font-heading text-xl font-semibold text-ink">
            Bạn chưa có đặt chỗ nào
          </h2>
          <p className="mt-2 text-sm text-muted">
            Chọn một buổi workshop để bắt đầu trải nghiệm.
          </p>
          <Link
            to="/kham-pha"
            className="mt-6 inline-flex min-h-11 items-center justify-center rounded-lg bg-primary px-5 text-sm font-semibold text-white transition-colors hover:bg-primary-hover"
          >
            Khám phá workshop
          </Link>
        </section>
      )}
    </PageContainer>
  );
}
