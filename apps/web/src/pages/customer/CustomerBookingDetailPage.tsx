import { useEffect, useRef, useState } from 'react';
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom';
import { apiFetch, ApiError } from '@/lib/api-client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { queryKeys } from '@/lib/query-keys';
import { formatPrice } from '@/lib/format';
import { bookingDetailState } from '@/lib/booking-detail';
import { customerBookingService } from '@/services/customerBookingService';
import { PageContainer } from '@/components/layout/PageContainer';
import { LoadingState } from '@/components/ui/LoadingState';
import { sessionLifecycleLabel } from './CustomerBookingsPage';
import { BookingSeatCancellation } from '@/components/details/BookingSeatCancellation';
import { CustomerRefundAccounts } from '@/components/management/CustomerRefundAccounts';
import { BookingReviewSection } from '@/components/reviews/BookingReviewSection';

import { BookingHeroHeader } from '@/components/booking-detail/BookingHeroHeader';
import { BookingTicketsSection } from '@/components/booking-detail/BookingTicketsSection';
import { BookingRescheduleNotice } from '@/components/booking-detail/BookingRescheduleNotice';
import { BookingCancellationDialog } from '@/components/booking-detail/BookingCancellationDialog';
import { BookingPaymentSummary } from '@/components/booking-detail/BookingPaymentSummary';

const primary =
  'inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-white hover:bg-primary-hover disabled:cursor-wait disabled:opacity-60';
const money = (amount: number) => `${formatPrice(amount)} đ`;

export function CustomerBookingDetailPage() {
  const { id = '' } = useParams();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const [checkResult, setCheckResult] = useState('');
  const [actionNotice, setActionNotice] = useState('');
  const [attendanceNotice, setAttendanceNotice] = useState('');
  const [attendanceBusy, setAttendanceBusy] = useState(false);
  const attendanceInFlight = useRef(false);
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const checkoutInFlight = useRef(false);
  const paymentQr = useRef<SVGSVGElement>(null);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [now, setNow] = useState(Date.now);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const cancelTrigger = useRef<HTMLButtonElement>(null);
  const cancelOpener = useRef<HTMLButtonElement | null>(null);
  const keepBooking = useRef<HTMLButtonElement>(null);
  const cancelInFlight = useRef(false);
  const retryInFlight = useRef(false);
  const expiryChecked = useRef('');
  const scheduleDeadlineChecked = useRef('');
  const attendanceDeadlineChecked = useRef('');
  const clockOffset = useRef(0);
  const detailKey = queryKeys.bookings.detail(user?.id, id);
  const listKey = queryKeys.bookings.list(user?.id, { view: 'customer' });

  const query = useQuery({
    queryKey: detailKey,
    queryFn: async ({ signal }) => {
      const booking = await customerBookingService.get(id, signal);
      if (booking.serverNow)
        clockOffset.current = Date.parse(booking.serverNow) - Date.now();
      setNow(Date.now() + clockOffset.current);
      const tickets = await customerBookingService.tickets(id, signal);
      return { booking, tickets };
    },
    enabled: Boolean(user && id),
    refetchInterval: (query) =>
      query.state.data?.booking.reschedulePending
        ? 10000
        : query.state.data?.booking.reservationStatus === 'confirmed' &&
            query.state.data.booking.releaseIfUnconfirmed &&
            !query.state.data.booking.attendanceConfirmedAt &&
            now < Date.parse(query.state.data.booking.startsAt)
          ? 10000
          : query.state.data?.booking.reservationStatus === 'pending' &&
              ['pending', 'expired'].includes(
                query.state.data.booking.paymentStatus,
              )
            ? 5000
            : query.state.data?.booking.refundStatus === 'pending'
              ? 15000
              : query.state.data?.booking.reservationStatus === 'confirmed' &&
                  now >= Date.parse(query.state.data.booking.startsAt)
                ? 30000
                : false,
  });

  const refetch = query.refetch;
  const cancelQuote = useQuery({
    queryKey: [...detailKey, 'cancellation-quote'],
    queryFn: ({ signal }) =>
      customerBookingService.cancellationQuote(id, signal),
    enabled: Boolean(user && id && confirmingCancel),
    staleTime: 0,
    gcTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  useEffect(() => {
    const tick = () => setNow(Date.now() + clockOffset.current);
    const sync = () => {
      tick();
      if (document.visibilityState === 'visible') void refetch();
    };
    const timer = window.setInterval(tick, 1000);
    window.addEventListener('focus', sync);
    document.addEventListener('visibilitychange', sync);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', sync);
      document.removeEventListener('visibilitychange', sync);
    };
  }, [refetch]);

  const source = query.data?.booking;

  useEffect(() => {
    if (
      !source?.attendanceConfirmationDeadline ||
      now < Date.parse(source.attendanceConfirmationDeadline)
    )
      return;
    const key = `${id}:${source.attendanceConfirmationDeadline}`;
    if (attendanceDeadlineChecked.current === key) return;
    attendanceDeadlineChecked.current = key;
    void refetch();
  }, [source, id, now, refetch]);

  const acceptScheduleInFlight = useRef(false);
  const acceptSchedule = useMutation({
    mutationFn: () => {
      if (!source?.scheduleVersion)
        throw new Error('Vui lòng tải lại để xem giờ học mới nhất.');
      return apiFetch('/bookings/' + id + '/accept-schedule', {
        method: 'POST',
        body: JSON.stringify({ scheduleVersion: source.scheduleVersion }),
      });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: detailKey }),
        queryClient.invalidateQueries({ queryKey: listKey }),
        queryClient.invalidateQueries({
          queryKey: ['booking-seats', user?.id, id],
        }),
      ]);
      setActionNotice('Đã giữ chỗ theo giờ học mới.');
    },
    onError: async () => {
      await refetch();
    },
    onSettled: () => {
      acceptScheduleInFlight.current = false;
    },
  });

  useEffect(() => {
    if (
      !source?.reschedulePending ||
      !source.rescheduleDeadline ||
      now < Date.parse(source.rescheduleDeadline)
    )
      return;
    const key = `${id}:${source.scheduleVersion}:${source.rescheduleDeadline}`;
    if (scheduleDeadlineChecked.current === key) return;
    scheduleDeadlineChecked.current = key;
    void refetch();
  }, [source, id, now, refetch]);

  useEffect(() => {
    if (
      !source ||
      source.reservationStatus !== 'pending' ||
      source.paymentStatus !== 'pending' ||
      now < Date.parse(source.holdExpiresAt)
    )
      return;
    const key = `${id}:${source.holdExpiresAt}`;
    if (expiryChecked.current === key) return;
    expiryChecked.current = key;
    void refetch();
  }, [source, id, now, refetch]);

  const cancel = useMutation({
    mutationFn: () => {
      if (!cancelQuote.data || cancelQuote.isFetching)
        throw new Error('Vui lòng chờ kiểm tra thông tin hủy.');
      return customerBookingService.cancel(id, cancelQuote.data.quoteToken);
    },
    onSuccess: async () => {
      setConfirmingCancel(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: detailKey }),
        queryClient.invalidateQueries({ queryKey: listKey }),
        queryClient.invalidateQueries({
          queryKey: ['booking-seats', user?.id, id],
        }),
      ]);
    },
    onError: async (error) => {
      if (
        error instanceof ApiError &&
        error.code === 'CANCELLATION_QUOTE_CHANGED'
      )
        await cancelQuote.refetch();
      const latest = await refetch();
      if (latest.data?.booking.reservationStatus === 'cancelled')
        setConfirmingCancel(false);
    },
    onSettled: () => {
      cancelInFlight.current = false;
    },
  });

  const retry = useMutation({
    mutationFn: async () => {
      if (!source) throw new Error('Không tìm thấy đặt chỗ.');
      return customerBookingService.create(
        {
          sessionId: source.sessionId,
          quantity: source.quantity,
          paymentChoice:
            source.paymentMode === 'payos_deposit' ? 'deposit' : 'in_studio',
        },
        user!.id,
        `retry:${source.id}`,
      );
    },
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: listKey });
      navigate(`/me/bookings/${result.booking.id}`);
    },
    onError: () => {
      void refetch();
    },
    onSettled: () => {
      retryInFlight.current = false;
    },
  });

  const resetCancel = cancel.reset;
  const resetRetry = retry.reset;
  useEffect(() => {
    resetCancel();
    resetRetry();
    setConfirmingCancel(false);
    cancelInFlight.current = false;
    retryInFlight.current = false;
    expiryChecked.current = '';
  }, [id, resetCancel, resetRetry]);

  if (query.isLoading)
    return (
      <PageContainer as="main" className="py-8">
        <LoadingState label="Đang tải chi tiết đặt chỗ…" />
      </PageContainer>
    );

  if (!query.data)
    return (
      <PageContainer as="main" className="py-8">
        <h1 className="font-heading text-2xl font-semibold">
          Chưa tải được đặt chỗ
        </h1>
        <p role="alert" className="mt-3 text-sm text-brick">
          {query.error?.message ?? 'Không tìm thấy đặt chỗ.'}
        </p>
        <button
          className="mt-4 min-h-11 font-semibold text-primary underline"
          onClick={() => void checkPayment()}
        >
          Thử tải lại
        </button>
      </PageContainer>
    );

  const { booking, tickets } = query.data;
  const state = bookingDetailState(booking, now);
  const sessionState = sessionLifecycleLabel(
    booking.startsAt,
    booking.endsAt,
    booking.sessionRecordStatus,
    now,
  );
  const sessionEnded = now >= Date.parse(booking.endsAt);
  const refundNeeded = booking.paymentStatus === 'refund_needed';
  const bookingLabel = state.expired
    ? 'Hết hạn giữ chỗ'
    : state.cancelled
      ? 'Đã hủy'
      : booking.reschedulePending
        ? 'Chờ xác nhận giờ mới'
        : booking.reservationStatus === 'completed' ||
            booking.attendanceStatus === 'attended'
          ? 'Đã hoàn thành'
          : state.confirmed
            ? 'Đã xác nhận'
            : 'Chờ đặt cọc';
  const checkingExpiry =
    state.deadlinePassed &&
    !state.expired &&
    !state.confirmed &&
    !state.cancelled &&
    !refundNeeded;

  const refundDue = cancelQuote.data?.refundDueAmount ?? 0;
  const retainedOnCancel = cancelQuote.data?.retainedAmount ?? 0;
  const retainedAfterCancel =
    state.cancelled &&
    ['pending', 'refunded', 'forfeited'].includes(booking.refundStatus ?? '')
      ? Math.max(
          0,
          (booking.receivedAmount ?? booking.paidAmount) -
            (booking.refundDueAmount ?? 0),
        )
      : 0;

  const cancellationDescription =
    cancelQuote.isFetching || !cancelQuote.data
      ? 'Đang kiểm tra thông tin hủy…'
      : cancelQuote.data.paidAmount === 0
        ? 'Bạn chưa thanh toán nên không mất khoản nào.'
        : [
            retainedOnCancel > 0
              ? `Buổi học diễn ra trong vòng 24 giờ, khoản cọc ${money(retainedOnCancel)} sẽ không được hoàn.`
              : '',
            refundDue > 0
              ? `Bạn sẽ được hoàn ${money(refundDue)} trong tối đa 7 ngày làm việc.`
              : '',
          ]
            .filter(Boolean)
            .join(' ') ||
          'Không phát sinh khoản hoàn mới. Các khoản đã hoàn được giữ trong lịch sử.';

  async function refreshCheckout() {
    if (checkoutInFlight.current) return;
    checkoutInFlight.current = true;
    setCheckoutBusy(true);
    try {
      const result = await customerBookingService.refreshCheckout(id);
      await refetch();
      setCheckResult(
        result.checkoutState === 'ready'
          ? 'Đã cập nhật mã cọc.'
          : result.checkoutState === 'awaiting_confirmation'
            ? 'Đang đồng bộ khoản thanh toán. Bạn chưa cần chuyển thêm.'
            : result.checkoutState === 'unavailable'
              ? 'Chỗ này không còn nhận thanh toán. Vui lòng xem trạng thái mới nhất.'
              : 'Chưa lấy được mã cọc. Hạn giữ chỗ vẫn giữ nguyên; bạn có thể kiểm tra lại sau ít giây.',
      );
    } catch (error) {
      setCheckResult(
        error instanceof Error
          ? error.message
          : 'Chưa lấy được mã cọc, vui lòng thử lại.',
      );
    } finally {
      checkoutInFlight.current = false;
      setCheckoutBusy(false);
    }
  }

  async function checkPayment() {
    const latest = await refetch();
    if (latest.isError) {
      setCheckResult('Chưa kiểm tra được thanh toán. Vui lòng thử lại.');
      return;
    }
    const data = latest.data?.booking;
    setCheckResult(
      data?.reservationStatus === 'confirmed' && data.paidAmount > 0
        ? 'Đã nhận cọc, chỗ của bạn đã được xác nhận'
        : data?.paymentStatus === 'expired'
          ? 'Hết thời gian giữ chỗ'
          : data?.reservationStatus === 'cancelled'
            ? 'Đặt chỗ đã hủy'
            : data?.paymentStatus === 'refund_needed'
              ? 'Khoản đã nhận đang được đối soát.'
              : 'Chưa nhận được tiền cọc, thử lại sau ít phút',
    );
  }

  async function bookingAction(path: string) {
    if (attendanceInFlight.current) return;
    attendanceInFlight.current = true;
    setAttendanceBusy(true);
    setAttendanceNotice('');
    try {
      await apiFetch('/bookings/' + id + '/' + path, { method: 'POST' });
      await refetch();
      setAttendanceNotice('');
    } catch (error) {
      await refetch();
      setAttendanceNotice(
        error instanceof Error
          ? error.message
          : 'Chưa cập nhật được, vui lòng thử lại.',
      );
    } finally {
      attendanceInFlight.current = false;
      setAttendanceBusy(false);
    }
  }

  function saveCalendar() {
    const stamp = (value: string) =>
      new Date(value)
        .toISOString()
        .replace(/[-:]/g, '')
        .replace(/\.\d{3}Z$/, 'Z');
    const escape = (text: string) =>
      text
        .replace(/\\/g, '\\\\')
        .replace(/[\r\n]+/g, ' ')
        .replace(/,/g, '\\,')
        .replace(/;/g, '\\;');
    const calendar = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Open Slot//VI',
      'BEGIN:VEVENT',
      'UID:' + id + '@open-slot',
      'DTSTAMP:' + stamp(new Date().toISOString()),
      'DTSTART:' + stamp(booking.startsAt),
      'DTEND:' + stamp(booking.endsAt),
      'SUMMARY:' + escape(booking.workshopTitle),
      'LOCATION:' + escape(booking.address ?? booking.studioName),
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');
    const url = URL.createObjectURL(
      new Blob([calendar], { type: 'text/calendar;charset=utf-8' }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = 'open-slot-' + booking.orderCode + '.ics';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <PageContainer as="main" className="py-8 pb-16">
      <Link
        to="/me/bookings"
        className="inline-flex min-h-11 items-center font-semibold text-primary hover:underline"
      >
        ← Chỗ đã đặt của tôi
      </Link>
      {searchParams.get('payment') === 'return' && !state.confirmed && (
        <p role="status" className="mt-3 rounded-lg bg-soft p-3 text-sm">
          Đang đồng bộ kết quả thanh toán. Đặt chỗ chỉ được xác nhận sau khi máy
          chủ xác minh khoản tiền.
        </p>
      )}
      <div className="mt-5 grid items-start gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(18rem,0.7fr)] lg:gap-8">
        <section className="order-last min-w-0 lg:order-first">
          <BookingHeroHeader
            booking={booking}
            isCancelled={state.cancelled}
            actionNotice={actionNotice}
            onSetActionNotice={setActionNotice}
            onSaveCalendar={saveCalendar}
          />
          <BookingTicketsSection
            tickets={tickets}
            isConfirmed={state.confirmed}
            isCancelled={state.cancelled}
            isExpired={state.expired}
            sessionEnded={sessionEnded}
          />
        </section>

        <aside
          className="order-first min-w-0 rounded-xl bg-surface p-5 lg:order-last"
          aria-label="Trạng thái và thanh toán"
        >
          {booking.reschedulePending && state.confirmed && (
            <BookingRescheduleNotice
              booking={booking}
              now={now}
              isAcceptPending={acceptSchedule.isPending}
              acceptErrorMessage={
                acceptSchedule.isError
                  ? acceptSchedule.error.message
                  : undefined
              }
              onAcceptSchedule={() => {
                if (acceptScheduleInFlight.current) return;
                acceptScheduleInFlight.current = true;
                acceptSchedule.mutate();
              }}
              onRequestCancel={(event) => {
                cancelOpener.current = event.currentTarget;
                cancel.reset();
                setConfirmingCancel(true);
              }}
            />
          )}

          <p
            role="status"
            className="mb-4 inline-flex rounded-full bg-primary/10 px-4 py-2 font-semibold text-primary"
          >
            {bookingLabel}
          </p>

          {state.confirmed &&
            !booking.reschedulePending &&
            booking.paymentMode !== 'payos_deposit' &&
            booking.releaseIfUnconfirmed &&
            !booking.attendanceConfirmedAt &&
            state.upcoming && (
              <section
                aria-label="Xác nhận sẽ đến"
                className="mb-4 space-y-3 rounded-lg bg-soft p-3"
              >
                {booking.paidAmount === 0 && (
                  <p className="text-sm leading-6">
                    {booking.attendanceConfirmationDeadline
                      ? `Vui lòng xác nhận bạn sẽ đến trước ${booking.attendanceConfirmationDeadline}. Nếu chưa xác nhận đúng hạn, chỗ của bạn sẽ được nhả.`
                      : 'Bạn có thể xác nhận sẽ đến ngay. Chỗ chỉ được nhả trước giờ học khi bạn chưa xác nhận và email yêu cầu xác nhận đã gửi thành công ít nhất 2 giờ.'}
                  </p>
                )}
                <button
                  className={primary}
                  disabled={attendanceBusy}
                  aria-busy={attendanceBusy}
                  onClick={() => void bookingAction('confirm-attendance')}
                >
                  {attendanceBusy ? 'Đang xác nhận…' : 'Xác nhận tôi sẽ đến'}
                </button>
              </section>
            )}

          {booking.attendanceConfirmedAt && state.confirmed && (
            <p role="status" className="mb-4 font-semibold text-primary">
              Bạn đã xác nhận sẽ đến.
            </p>
          )}

          {attendanceNotice && (
            <p role="status" className="mb-4 text-sm">
              {attendanceNotice}
            </p>
          )}

          {(refundNeeded || booking.refundStatus === 'pending') && (
            <CustomerRefundAccounts bookingId={id} />
          )}

          <BookingReviewSection bookingId={id} />

          <BookingPaymentSummary
            booking={booking}
            state={state}
            checkingExpiry={checkingExpiry}
            queryIsFetching={query.isFetching}
            queryIsRefetchError={query.isRefetchError}
            checkResult={checkResult}
            retainedAfterCancel={retainedAfterCancel}
            refundNeeded={refundNeeded}
            sessionState={sessionState}
            paymentQrRef={paymentQr}
            retryIsPending={retry.isPending}
            retryIsError={retry.isError}
            retryErrorMessage={retry.error?.message}
            checkoutBusy={checkoutBusy}
            onRefreshCheckout={() => void refreshCheckout()}
            onCheckPayment={() => void checkPayment()}
            onRetry={() => {
              if (retryInFlight.current) return;
              retryInFlight.current = true;
              retry.mutate();
            }}
            onSetCheckResult={setCheckResult}
          />

          <BookingSeatCancellation
            bookingId={id}
            pending={booking.reservationStatus === 'pending'}
            onUpdated={async () => {
              await Promise.all([
                queryClient.invalidateQueries({ queryKey: detailKey }),
                queryClient.invalidateQueries({ queryKey: listKey }),
              ]);
            }}
          />

          {((state.canCancel && !booking.reschedulePending) ||
            cancel.isPending ||
            cancel.isSuccess ||
            cancel.isError ||
            confirmingCancel) && (
            <button
              ref={cancelTrigger}
              type="button"
              aria-disabled={
                cancel.isPending || cancel.isSuccess || state.cancelled
              }
              onClick={() => {
                if (cancel.isPending || cancel.isSuccess || state.cancelled)
                  return;
                cancelOpener.current = cancelTrigger.current;
                cancel.reset();
                setConfirmingCancel(true);
              }}
              className="mt-3 min-h-11 w-full border-t border-stone-200 pt-3 text-sm font-semibold text-brick underline"
            >
              {cancel.isSuccess || state.cancelled
                ? 'Đã hủy đặt chỗ'
                : 'Hủy đặt chỗ'}
            </button>
          )}

          <BookingCancellationDialog
            open={confirmingCancel}
            onOpenChange={(open) => {
              if (!cancelInFlight.current) setConfirmingCancel(open);
            }}
            isPending={cancel.isPending}
            isFetchingQuote={cancelQuote.isFetching}
            quoteHasError={cancelQuote.isError}
            quoteHasData={Boolean(cancelQuote.data)}
            cancelErrorMessage={
              cancel.isError ? cancel.error.message : undefined
            }
            cancellationDescription={cancellationDescription}
            cancelOpenerRef={cancelOpener}
            cancelTriggerRef={cancelTrigger}
            keepBookingRef={keepBooking}
            onRetryQuote={() => void cancelQuote.refetch()}
            onConfirmCancel={() => {
              if (cancelInFlight.current) return;
              cancelInFlight.current = true;
              cancel.mutate();
            }}
          />
        </aside>
      </div>
    </PageContainer>
  );
}
