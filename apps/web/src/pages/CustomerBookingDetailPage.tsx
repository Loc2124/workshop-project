import { useEffect, useRef, useState } from 'react';
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { apiFetch, ApiError } from '../lib/api-client';
import { downloadQrPng } from '../lib/download-qr';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../hooks/useAuth';
import { queryKeys } from '../lib/query-keys';
import { formatDate, formatPrice } from '../lib/format';
import { bookingDisplayText } from '../lib/display-text';
import {
  bookingDetailState,
  bookingScheduleLabel,
} from '../lib/booking-detail';
import { customerBookingService } from '../services/customerBookingService';
import { PageContainer } from '../components/layout/PageContainer';
import { LoadingState } from '../components/ui/LoadingState';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '../components/ui/dialog';
import { sessionLifecycleLabel } from './CustomerBookingsPage';
import { BookingSeatCancellation } from '../components/details/BookingSeatCancellation';
import { CustomerRefundAccounts } from '../components/management/CustomerRefundAccounts';

const primary =
  'inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-white hover:bg-primary-hover disabled:cursor-wait disabled:opacity-60';
const secondary =
  'inline-flex min-h-11 items-center justify-center rounded-lg border border-primary px-4 text-sm font-semibold text-primary hover:bg-soft disabled:opacity-60';
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
          <h1 className="font-heading text-3xl font-semibold">
            {bookingDisplayText(booking.workshopTitle, 'Buổi học')}
          </h1>
          <Link
            className="mt-2 inline-block min-h-11 text-primary underline"
            to={'/studios/' + (booking.studioSlug ?? booking.workshopId)}
          >
            Studio: {bookingDisplayText(booking.studioName, 'Studio')}
          </Link>
          <p className="mt-2 font-semibold tabular-nums">
            {bookingScheduleLabel(
              state.cancelled && booking.bookedStartsAt
                ? booking.bookedStartsAt
                : booking.startsAt,
              state.cancelled && booking.bookedEndsAt
                ? booking.bookedEndsAt
                : booking.endsAt,
            )}
          </p>
          <dl className="mt-5 grid gap-4 rounded-xl bg-surface p-5 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-stone-600">Mã đơn đặt chỗ</dt>
              <dd className="mt-1 font-semibold">{booking.orderCode}</dd>
            </div>
            <div>
              <dt className="text-stone-600">Số người</dt>
              <dd className="mt-1 font-semibold">{booking.quantity}</dd>
            </div>
            <div>
              <dt className="text-stone-600">Người liên hệ</dt>
              <dd className="mt-1">
                {bookingDisplayText(booking.contactName, 'Khách tham gia')}
                <br />
                {booking.contactPhone}
              </dd>
            </div>
            <div>
              <dt className="text-stone-600">Địa điểm</dt>
              <dd className="mt-1">{booking.address ?? booking.studioName}</dd>
            </div>
          </dl>
          {(booking.seatRevision ?? 0) > 0 && (
            <p className="mt-3 text-sm text-stone-700">
              Ban đầu bạn đặt {booking.originalQuantity} chỗ, tổng{' '}
              {money(booking.originalTotalAmount ?? booking.totalAmount)}. Hiện
              còn {booking.remainingQuantity ?? booking.quantity} chỗ có hiệu
              lực.
            </p>
          )}
          {actionNotice && (
            <p role="status" className="mt-2 text-sm">
              {actionNotice}
            </p>
          )}
          <div className="mt-4 flex flex-wrap gap-3">
            <button className={secondary} onClick={saveCalendar}>
              Thêm vào lịch
            </button>
            <button
              className={secondary}
              onClick={() =>
                void navigator.clipboard
                  .writeText(String(booking.orderCode))
                  .then(() => setActionNotice('Đã sao chép mã đặt chỗ.'))
                  .catch(() =>
                    setActionNotice(
                      'Chưa sao chép được. Bạn có thể chọn mã đặt chỗ để sao chép.',
                    ),
                  )
              }
            >
              Sao chép mã đặt chỗ
            </button>
            {booking.studioContactPhone && (
              <a
                className={secondary}
                href={'tel:' + booking.studioContactPhone}
              >
                Liên hệ studio
              </a>
            )}
          </div>
          {booking.address && (
            <iframe
              title="Bản đồ studio"
              className="mt-4 h-56 w-full rounded-xl border-0"
              loading="lazy"
              referrerPolicy="no-referrer"
              src={
                'https://maps.google.com/maps?q=' +
                encodeURIComponent(booking.address) +
                '&output=embed'
              }
            />
          )}
          <p className="mt-4 text-sm leading-6 text-stone-700">
            Hủy miễn phí trước giờ học 24h. Nếu bạn chưa đặt cọc, bạn có thể hủy
            bất cứ lúc nào.
          </p>
          <section className="mt-7" aria-labelledby="booking-tickets-title">
            <h2
              id="booking-tickets-title"
              className="font-heading text-xl font-semibold"
            >
              Vé tham gia
            </h2>
            {state.confirmed && tickets.length ? (
              <ul className="mt-3 grid gap-3 sm:grid-cols-2">
                {tickets.map((ticket) => (
                  <li
                    key={ticket.id}
                    className="flex min-w-0 flex-wrap items-center gap-3 rounded-xl bg-surface p-4"
                  >
                    {!sessionEnded && ticket.status === 'valid' && (
                      <QRCodeSVG
                        value={`OS-TICKET:${ticket.code}`}
                        size={112}
                        title={`Mã QR vé tham gia ${ticket.seq}`}
                        className="shrink-0"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold">Vé số {ticket.seq}</h3>
                      <p className="mt-1 text-sm">
                        {ticket.attendanceStatus === 'attended'
                          ? ticket.attendanceMethod === 'manual_confirmation'
                            ? 'Đã tham dự · Xác nhận thủ công'
                            : 'Đã tham dự'
                          : sessionEnded &&
                              ticket.attendanceStatus === 'unmarked'
                            ? 'Đã qua buổi · Chưa check-in'
                            : ticket.attendanceStatus === 'absent'
                              ? 'Vắng mặt'
                              : ticket.status === 'valid'
                                ? 'Còn hiệu lực'
                                : ticket.status === 'used'
                                  ? 'Đã sử dụng'
                                  : 'Đã vô hiệu'}
                      </p>
                      {!sessionEnded && ticket.status === 'valid' && (
                        <p className="mt-1 text-xs text-stone-600">
                          Xuất trình QR tại studio trước giờ kết thúc buổi học.
                        </p>
                      )}
                      {sessionEnded && ticket.status === 'valid' && (
                        <p className="mt-1 text-xs text-stone-600">
                          QR đã hết hiệu lực sau giờ kết thúc buổi học.
                        </p>
                      )}
                      {ticket.manualCode &&
                        ticket.status === 'valid' &&
                        ticket.attendanceStatus === 'unmarked' && (
                          <p className="mt-1 font-mono text-sm font-semibold tracking-widest text-stone-700">
                            Mã nhập tay: {ticket.manualCode}
                          </p>
                        )}
                      {ticket.attendanceStatus === 'attended' && (
                        <p className="mt-1 text-xs text-stone-600">
                          {ticket.attendanceMarkedAt
                            ? `Ghi nhận lúc ${formatDate(ticket.attendanceMarkedAt)}`
                            : 'Đã ghi nhận tham dự'}
                          {ticket.attendanceMarkedBy
                            ? ` bởi ${ticket.attendanceMarkedBy}`
                            : ''}
                          .
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-stone-600">
                {state.cancelled || state.expired
                  ? 'Đặt chỗ này không có vé tham gia còn hiệu lực.'
                  : 'Vé sẽ hiện ở đây sau khi chỗ của bạn được xác nhận.'}
              </p>
            )}
          </section>
        </section>
        <aside
          className="order-first min-w-0 rounded-xl bg-surface p-5 lg:order-last"
          aria-label="Trạng thái và thanh toán"
        >
          {booking.reschedulePending && state.confirmed && (
            <section
              aria-label="Thay đổi giờ học"
              className="mb-5 rounded-lg border border-primary/25 bg-soft p-4 text-sm leading-6"
            >
              <h2 className="font-heading text-xl font-semibold">
                Studio đã đổi giờ học
              </h2>
              {booking.bookedStartsAt && booking.bookedEndsAt && (
                <p className="mt-3 text-stone-600">
                  Giờ cũ:{' '}
                  {bookingScheduleLabel(
                    booking.bookedStartsAt,
                    booking.bookedEndsAt,
                  )}
                </p>
              )}
              <p className="mt-1 font-semibold">
                Giờ mới:{' '}
                {bookingScheduleLabel(booking.startsAt, booking.endsAt)}
              </p>
              {booking.rescheduleDeadline && (
                <p className="mt-3">
                  Vui lòng phản hồi trước{' '}
                  <strong>{formatDate(booking.rescheduleDeadline)}</strong>.
                </p>
              )}
              <p className="mt-2">
                Bạn có thể giữ chỗ theo giờ mới hoặc hủy để được hoàn toàn bộ số
                tiền đã trả. Nếu không phản hồi đúng hạn, đặt chỗ sẽ tự hủy.
              </p>
              <button
                type="button"
                className={primary + ' mt-4'}
                disabled={
                  acceptSchedule.isPending ||
                  !booking.scheduleVersion ||
                  (!!booking.rescheduleDeadline &&
                    now >= Date.parse(booking.rescheduleDeadline))
                }
                aria-busy={acceptSchedule.isPending}
                onClick={() => {
                  if (acceptScheduleInFlight.current) return;
                  acceptScheduleInFlight.current = true;
                  acceptSchedule.mutate();
                }}
              >
                {acceptSchedule.isPending
                  ? 'Đang xác nhận…'
                  : 'Giữ chỗ theo giờ mới'}
              </button>
              <button
                type="button"
                className={secondary + ' mt-2 w-full'}
                onClick={(event) => {
                  cancelOpener.current = event.currentTarget;
                  cancel.reset();
                  setConfirmingCancel(true);
                }}
              >
                Hủy đặt chỗ
              </button>
              {acceptSchedule.isError && (
                <p role="alert" className="mt-3 text-brick">
                  {acceptSchedule.error.message}
                </p>
              )}
              {booking.rescheduleDeadline &&
                now >= Date.parse(booking.rescheduleDeadline) && (
                  <p role="status" className="mt-3">
                    Đã hết hạn phản hồi. Đang cập nhật đặt chỗ…
                  </p>
                )}
            </section>
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
                      ? `Vui lòng xác nhận bạn sẽ đến trước ${formatDate(booking.attendanceConfirmationDeadline)}. Nếu chưa xác nhận đúng hạn, chỗ của bạn sẽ được nhả.`
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
          {state.canPay && (
            <div
              className={
                'mb-4 rounded-xl border p-4 text-center ' +
                (state.remainingSeconds < 120
                  ? 'border-amber-400 bg-amber-50 text-amber-950'
                  : 'border-primary/20 bg-soft')
              }
            >
              <p className="text-sm font-semibold">
                Chỗ của bạn được giữ trong
              </p>
              <p
                className="mt-1 font-heading text-2xl font-bold tabular-nums sm:text-3xl xl:text-4xl"
                aria-label={`Còn ${Math.floor(state.remainingSeconds / 60)} phút ${state.remainingSeconds % 60} giây`}
              >
                {Math.floor(state.remainingSeconds / 60)} phút{' '}
                {state.remainingSeconds % 60} giây
              </p>
              <p className="mt-2 text-sm text-stone-700">
                Hết hạn lúc{' '}
                {new Intl.DateTimeFormat('vi-VN', {
                  hour: '2-digit',
                  minute: '2-digit',
                  hourCycle: 'h23',
                  timeZone: 'Asia/Ho_Chi_Minh',
                }).format(new Date(booking.holdExpiresAt))}
                ,{' '}
                {new Intl.DateTimeFormat('vi-VN', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  timeZone: 'Asia/Ho_Chi_Minh',
                }).format(new Date(booking.holdExpiresAt))}
              </p>
            </div>
          )}
          {booking.paymentMode === 'in_studio' && !state.cancelled && (
            <p className="mt-4 rounded-lg bg-soft p-3 text-sm">
              {state.actualBalance > 0
                ? `Bạn sẽ thanh toán ${money(state.actualBalance)} tại studio.`
                : 'Bạn đã thanh toán đủ.'}
            </p>
          )}
          {(refundNeeded || booking.refundStatus === 'pending') && (
            <CustomerRefundAccounts bookingId={id} />
          )}
          {state.expired && (
            <p
              role="status"
              className="mb-4 rounded-lg bg-stone-100 p-3 font-semibold"
            >
              Hết thời gian giữ chỗ
            </p>
          )}
          {checkingExpiry && (
            <p role="status" className="mb-4 rounded-lg bg-soft p-3 text-sm">
              Đang kiểm tra thời gian giữ chỗ…
            </p>
          )}
          {!state.upcoming &&
            !state.confirmed &&
            !state.cancelled &&
            !state.expired && (
              <p className="mb-4 text-sm text-stone-600">
                Buổi học đã bắt đầu hoặc đã hủy. Không thể tiếp tục thanh toán
                cọc.
              </p>
            )}
          {booking.paymentAllowed === false &&
            booking.reservationStatus === 'pending' &&
            state.upcoming &&
            !state.expired &&
            !checkingExpiry && (
              <p role="status" className="mb-4 text-sm">
                Lịch này hiện không nhận thanh toán cọc. Bạn có thể hủy các chỗ
                chưa thanh toán hoặc liên hệ studio để được hỗ trợ.
              </p>
            )}
          <h2 className="font-heading text-lg font-semibold">Thanh toán</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt>
                {(booking.seatRevision ?? 0) > 0
                  ? state.cancelled
                    ? 'Giá trị trước lần hủy cuối'
                    : 'Giá trị chỗ còn giữ'
                  : 'Tổng tiền'}
              </dt>
              <dd className="whitespace-nowrap font-semibold">
                {money(booking.totalAmount)}
              </dd>
            </div>
            {booking.receivedAmount !== undefined &&
              ((booking.seatRevision ?? 0) > 0 ||
                state.cancelled ||
                refundNeeded) && (
                <div className="flex justify-between gap-4">
                  <dt>Đã nhận trong cả đặt chỗ</dt>
                  <dd className="whitespace-nowrap font-semibold">
                    {money(booking.receivedAmount)}
                  </dd>
                </div>
              )}
            {booking.paymentMode === 'payos_deposit' && !state.cancelled && (
              <>
                <div className="flex justify-between gap-4">
                  <dt>{state.depositPaid ? 'Tiền cọc đã nhận' : 'Tiền cọc'}</dt>
                  <dd className="whitespace-nowrap font-semibold">
                    {money(booking.depositAmount)}
                  </dd>
                </div>
                <div className="flex justify-between gap-4 border-t border-stone-200 pt-2">
                  <dt>
                    {state.cancelled
                      ? 'Phần chưa thanh toán'
                      : state.depositPaid
                        ? 'Còn trả tại studio'
                        : 'Còn lại thanh toán tại studio'}
                  </dt>
                  <dd className="whitespace-nowrap font-semibold">
                    {money(
                      state.depositPaid
                        ? state.actualBalance
                        : state.projectedStudioAmount,
                    )}
                  </dd>
                </div>
              </>
            )}
            {booking.paymentMode !== 'payos_deposit' && !state.cancelled && (
              <div className="flex justify-between gap-4">
                <dt>Còn phải trả</dt>
                <dd className="font-semibold">{money(state.actualBalance)}</dd>
              </div>
            )}
          </dl>
          {state.canPay && !query.isRefetchError && (
            <div className="mt-4">
              <p className="mb-2 text-center text-sm font-semibold">
                Quét bằng app ngân hàng
              </p>
              <p className="mb-3 text-center text-sm">
                Số tiền: {money(booking.depositAmount)} · Nội dung:{' '}
                {state.deposit?.transferDescription ??
                  state.deposit?.orderCode ??
                  booking.orderCode}
              </p>
              {state.deposit?.qrCode && (
                <QRCodeSVG
                  value={state.deposit.qrCode}
                  size={184}
                  title="Mã QR thanh toán tiền cọc"
                  ref={paymentQr}
                  className="mx-auto max-w-full rounded-lg bg-white p-2"
                />
              )}
              {state.deposit?.qrCode && (
                <button
                  type="button"
                  className={secondary + ' mt-2 w-full'}
                  onClick={() => {
                    if (paymentQr.current)
                      void downloadQrPng(
                        paymentQr.current,
                        'ma-coc-' + booking.orderCode + '.png',
                      ).catch(() =>
                        setCheckResult('Chưa tải được mã, vui lòng thử lại.'),
                      );
                  }}
                >
                  Tải mã QR
                </button>
              )}
              {state.deposit?.checkoutUrl && (
                <a
                  href={state.deposit.checkoutUrl}
                  target="_blank"
                  rel="noreferrer"
                  className={`${primary} mt-3`}
                >
                  Mở trang thanh toán · Cọc {money(booking.depositAmount)}
                </a>
              )}
              <button
                type="button"
                className={secondary + ' mt-2 w-full'}
                disabled={query.isFetching}
                onClick={() => void checkPayment()}
              >
                {query.isFetching ? 'Đang kiểm tra…' : 'Kiểm tra thanh toán'}
              </button>
              <p className="mt-2 text-center text-sm leading-6 text-stone-700">
                Chỗ được xác nhận ngay khi chúng tôi nhận được tiền cọc.
              </p>
            </div>
          )}
          {retainedAfterCancel > 0 && (
            <p
              role="status"
              className="mt-3 rounded-lg bg-amber-50 p-3 text-sm"
            >
              Khoản cọc {money(retainedAfterCancel)} không được hoàn vì bạn hủy
              trong vòng 24 giờ trước buổi học.
            </p>
          )}
          {booking.refundStatus === 'refunded' && (
            <p role="status" className="mt-3 rounded-lg bg-soft p-3 text-sm">
              Open Slot đã chuyển khoản hoàn{' '}
              {money(booking.refundedAmount ?? booking.refundDueAmount ?? 0)}.
              Bạn vui lòng kiểm tra tài khoản nhận tiền.
            </p>
          )}
          {(refundNeeded || booking.refundStatus === 'pending') && (
            <p
              role="status"
              className="mt-4 rounded-lg bg-amber-50 p-3 text-sm"
            >
              Số tiền cần hoàn:{' '}
              {money(
                Math.max(
                  0,
                  (booking.refundDueAmount ?? booking.paidAmount) -
                    (booking.refundedAmount ?? 0),
                ),
              )}
              . Open Slot đang đối soát và xử lý trong tối đa 7 ngày làm việc.
            </p>
          )}
          {state.expired && (
            <div className="mt-4">
              {booking.canRebook && state.upcoming ? (
                <button
                  type="button"
                  disabled={retry.isPending}
                  className={primary}
                  onClick={() => {
                    if (retryInFlight.current) return;
                    retryInFlight.current = true;
                    retry.mutate();
                  }}
                >
                  {retry.isPending ? 'Đang đặt lại…' : 'Đặt lại'}
                </button>
              ) : (
                <Link
                  className={`${secondary} w-full`}
                  to={`/workshop/${booking.workshopId}#lich-trai-nghiem`}
                >
                  Xem lịch khác
                </Link>
              )}
              {retry.isError && (
                <p role="alert" className="mt-2 text-sm text-brick">
                  {retry.error.message}{' '}
                  <Link
                    className="underline"
                    to={`/workshop/${booking.workshopId}#lich-trai-nghiem`}
                  >
                    Xem lịch khác
                  </Link>
                </p>
              )}
            </div>
          )}
          {sessionState === 'Đã kết thúc' && (
            <Link
              className={`${secondary} mt-4 w-full`}
              to={`/workshop/${booking.workshopId}#lich-trai-nghiem`}
            >
              Xem các buổi sắp tới
            </Link>
          )}
          {checkResult && (
            <p role="status" className="mt-3 rounded-lg bg-soft p-3 text-sm">
              {checkResult}
            </p>
          )}
          {query.isRefetchError && (
            <p role="alert" className="mt-3 text-sm text-brick">
              Chưa đồng bộ được trạng thái. Vui lòng kiểm tra lại trước khi
              thanh toán.
            </p>
          )}
          {(!state.canPay || query.isRefetchError) && (
            <button
              type="button"
              className={secondary + ' mt-3 w-full'}
              disabled={query.isFetching}
              onClick={() => void checkPayment()}
            >
              {query.isFetching ? 'Đang kiểm tra…' : 'Kiểm tra thanh toán'}
            </button>
          )}
          {state.canPay &&
            (booking.seatRevision ?? 0) > 0 &&
            !state.deposit?.checkoutUrl && (
              <div className="mt-3 text-sm">
                <p>
                  Đã cập nhật số chỗ. Bạn cần lấy mã cọc mới trước khi thanh
                  toán; hạn giữ chỗ không đổi.
                </p>
                <button
                  type="button"
                  className={secondary + ' mt-2 w-full'}
                  disabled={checkoutBusy}
                  aria-busy={checkoutBusy}
                  onClick={() => void refreshCheckout()}
                >
                  {checkoutBusy ? 'Đang kiểm tra…' : 'Kiểm tra mã cọc mới'}
                </button>
              </div>
            )}
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
          <Dialog
            open={confirmingCancel}
            onOpenChange={(open) => {
              if (!cancelInFlight.current) setConfirmingCancel(open);
            }}
          >
            <DialogContent
              className="max-h-[calc(100dvh-2rem)] overflow-y-auto bg-surface p-5 sm:p-6"
              closeDisabled={cancel.isPending}
              onOpenAutoFocus={(event) => {
                event.preventDefault();
                keepBooking.current?.focus();
              }}
              onCloseAutoFocus={(event) => {
                event.preventDefault();
                const opener = cancelOpener.current;
                (opener?.isConnected ? opener : cancelTrigger.current)?.focus();
              }}
            >
              <DialogTitle className="pr-10 font-heading text-xl">
                Hủy đặt chỗ này?
              </DialogTitle>
              <DialogDescription className="mt-3 leading-6">
                {cancellationDescription}
              </DialogDescription>
              {cancelQuote.isError && (
                <p role="alert" className="mt-3 text-sm text-brick">
                  Chưa kiểm tra được thông tin hủy.{' '}
                  <button
                    type="button"
                    className="underline"
                    onClick={() => void cancelQuote.refetch()}
                  >
                    Thử lại
                  </button>
                </p>
              )}
              {cancel.isError && (
                <p role="alert" className="mt-4 text-sm text-brick">
                  {cancel.error.message} Chưa nhận được xác nhận hủy. Vui lòng
                  kiểm tra trạng thái trước khi thử lại.
                </p>
              )}
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <button
                  ref={keepBooking}
                  type="button"
                  disabled={cancel.isPending}
                  className={`${secondary} flex-1`}
                  onClick={() => setConfirmingCancel(false)}
                >
                  Giữ đặt chỗ
                </button>
                <button
                  type="button"
                  disabled={
                    cancel.isPending ||
                    cancelQuote.isFetching ||
                    !cancelQuote.data ||
                    cancelQuote.isError
                  }
                  aria-busy={cancel.isPending || cancelQuote.isFetching}
                  className="min-h-11 flex-1 rounded-lg bg-brick px-4 text-sm font-semibold text-white disabled:cursor-wait disabled:opacity-60"
                  onClick={() => {
                    if (cancelInFlight.current) return;
                    cancelInFlight.current = true;
                    cancel.mutate();
                  }}
                >
                  {cancel.isPending ? 'Đang hủy…' : 'Xác nhận hủy'}
                </button>
              </div>
            </DialogContent>
          </Dialog>
        </aside>
      </div>
    </PageContainer>
  );
}
