import { useRef, useState, type FormEvent } from 'react';
import { CalendarDays, CalendarPlus, MapPin, Minus, Plus } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import type { Workshop, WorkshopSession } from '../../types/workshop';
import { formatPrice } from '../../lib/format';
import { sessionCalendar } from '../../lib/workshopDetails';
import { sessionStatus, sessionStatusLabel } from '../../lib/sessionStatus';
import { useSessionClock } from '../../hooks/useSessionClock';
import { ScheduleNotification } from './ScheduleNotification';
import { cn } from '../../lib/utils';
import { WorkshopRating } from './WorkshopRating';
import { workshopText, workshopSessionRange } from './workshopPresentation';
import { bookingFormSchema } from '../../lib/form-validation';
import { toast } from 'sonner';
import { calculateDeposit } from '@workshop/shared';

const MAX_BOOKING_QUANTITY = 10;

export function bookingQuantityLimit(availableSeats: number): number {
  return Math.min(Math.max(0, availableSeats), MAX_BOOKING_QUANTITY);
}

export function clampBookingQuantity(
  quantity: number,
  availableSeats: number,
): number {
  return Math.min(Math.max(1, quantity), bookingQuantityLimit(availableSeats));
}

export type WorkshopBookingRequest = {
  workshopId: string;
  sessionId: string;
  quantity: number;
  paymentChoice?: 'deposit' | 'in_studio';
};
export type WorkshopBookingHandler = (
  request: WorkshopBookingRequest,
) => Promise<{
  id: string;
  checkoutUrl?: string | null;
  checkoutQrCode?: string | null;
}>;
// Inject the booking API through onBook; never treat a calendar download as a booking.

export function WorkshopSchedule({
  workshop,
  onBook,
}: {
  workshop: Workshop;
  onBook?: WorkshopBookingHandler;
}) {
  const now = useSessionClock(workshop.sessions);
  const [showOtherSessions, setShowOtherSessions] = useState(false);
  const [choice, setChoice] = useState<'deposit' | 'in_studio'>('in_studio');
  const depositMode = workshop.depositMode ?? 'none';
  const paymentChoice =
    depositMode === 'required'
      ? 'deposit'
      : depositMode === 'none'
        ? 'in_studio'
        : choice;
  const sessions = workshop.sessions
    .filter(
      (session) =>
        Number.isFinite(session.price) &&
        session.price >= 0 &&
        Number.isInteger(session.availableSeats) &&
        session.availableSeats >= 0 &&
        Date.parse(session.endsAt) > now,
    )
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
  const initial = sessions.find(
    (session) => sessionStatus(session, now) === 'available',
  );
  const [selectedId, setSelectedId] = useState(initial?.id);
  const [quantity, setQuantity] = useState(1);
  const [pending, setPending] = useState(false);
  const [confirmed, setConfirmed] = useState<{
    id: string;
    session: WorkshopSession;
    quantity: number;
  }>();
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const submitting = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const locationPath = useLocation();
  const navigate = useNavigate();
  const selected =
    confirmed?.session ??
    sessions.find(
      (session) =>
        session.id === selectedId &&
        sessionStatus(session, now) === 'available',
    ) ??
    initial;
  const seats =
    confirmed?.quantity ??
    (selected ? clampBookingQuantity(quantity, selected.availableSeats) : 0);
  const total = selected ? selected.price * seats : undefined;
  const depositPercent =
    workshop.effectiveDepositPercent ?? workshop.depositPercent ?? 0;
  const depositAmount =
    total !== undefined && paymentChoice === 'deposit' && depositPercent > 0
      ? calculateDeposit(total, depositPercent)
      : 0;
  const balanceAmount = total === undefined ? 0 : total - depositAmount;
  const locked = pending || Boolean(confirmed);
  const primary =
    'inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-primary px-5 text-sm font-semibold text-white hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary disabled:cursor-not-allowed disabled:bg-stone-200 disabled:text-stone-600';
  const location = [
    workshopText(workshop.studioName),
    workshopText(workshop.province),
  ]
    .filter(Boolean)
    .join(' · ');

  async function book(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || !seats || confirmed || submitting.current) return;
    if (sessionStatus(selected, Date.now()) !== 'available') {
      setError('Buổi này đã đóng đăng ký. Vui lòng chọn lịch khác.');
      return;
    }
    setError('');
    setNotice('');
    const parsed = bookingFormSchema.safeParse({
      workshopId: workshop.id,
      sessionId: selected.id,
      quantity: seats,
      availableSeats: selected.availableSeats,
    });
    if (!parsed.success) {
      setError('Kiểm tra lại buổi và số người tham gia.');
      return;
    }
    if (!onBook) {
      setError('Đặt chỗ hiện chưa khả dụng. Vui lòng thử lại sau.');
      return;
    }
    submitting.current = true;
    setPending(true);
    const snapshot = { ...selected };
    try {
      const result = await onBook({ ...parsed.data, paymentChoice });
      if (!result?.id?.trim())
        throw new Error('Chưa nhận được xác nhận đặt chỗ.');
      if (result.checkoutUrl) {
        if (result.checkoutQrCode) {
          navigate(
            `/me/bookings/${encodeURIComponent(result.id)}?payment=checkout`,
          );
          return;
        }
        const checkout = new URL(result.checkoutUrl);
        if (
          checkout.protocol !== 'https:' &&
          checkout.origin !== window.location.origin
        ) {
          throw new Error('Đường dẫn thanh toán không an toàn.');
        }
        window.location.assign(checkout.toString());
        return;
      }
      setConfirmed({ id: result.id, session: snapshot, quantity: seats });
      setNotice('Đã nhận đặt chỗ. Mở lịch sử đặt chỗ để xem vé và thanh toán.');
    } catch (cause) {
      const message =
        cause instanceof Error
          ? cause.message
          : 'Chưa đặt được chỗ. Vui lòng thử lại.';
      setError(message);
      toast.error(message);
    } finally {
      submitting.current = false;
      setPending(false);
    }
  }

  function saveCalendar() {
    if (!confirmed) return;
    const url = URL.createObjectURL(
      new Blob([sessionCalendar(workshop, confirmed.session)], {
        type: 'text/calendar;charset=utf-8',
      }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = 'open-slot-' + confirmed.id + '.ics';
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice('Đã tải lịch trải nghiệm về máy.');
  }

  const dateDetails = (session: WorkshopSession) => (
    <span className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-2">
      <time
        dateTime={session.startsAt}
        className="inline-flex items-center gap-2 text-sm font-semibold tabular-nums"
      >
        <CalendarDays
          size={16}
          className="shrink-0 text-primary"
          aria-hidden="true"
        />
        {workshopSessionRange(session)}
      </time>
      <span className="rounded-md bg-lime-100 px-2.5 py-1 text-xs font-semibold text-primary">
        {confirmed
          ? 'Đã đặt ' + confirmed.quantity + ' chỗ'
          : sessionStatus(session, now) === 'available'
            ? 'Còn ' + session.availableSeats + ' chỗ'
            : sessionStatusLabel[sessionStatus(session, now)]}
      </span>
    </span>
  );

  return (
    <>
      <section
        id="lich-trai-nghiem"
        aria-labelledby="booking-title"
        className="scroll-mt-24 rounded-2xl border border-stone-200 bg-stone-50 p-5 sm:p-6"
      >
        <div className="flex flex-wrap items-baseline gap-2">
          <h1
            id="booking-title"
            ref={heading}
            tabIndex={-1}
            className="font-heading text-2xl font-semibold leading-tight focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
          >
            {workshop.title}
          </h1>
        </div>
        <div className="mt-3">
          <WorkshopRating workshop={workshop} />
        </div>
        {location && (
          <p className="mt-3 flex items-start gap-2 text-sm text-stone-700">
            <MapPin size={16} className="mt-1 shrink-0" aria-hidden="true" />
            {location}
          </p>
        )}
        <form
          noValidate
          id="workshop-booking-form"
          onSubmit={book}
          className="mt-5 space-y-5"
          aria-busy={pending}
        >
          {confirmed ||
          sessions.length === 1 ||
          (sessions.length > 1 && !showOtherSessions) ? (
            <div className="rounded-xl bg-soft p-4">
              {dateDetails(confirmed?.session ?? selected ?? sessions[0])}
            </div>
          ) : sessions.length > 1 ? (
            <fieldset disabled={locked} className="space-y-2">
              <legend className="mb-2 text-sm font-semibold">Chọn buổi</legend>
              {sessions.map((session) => (
                <label
                  key={session.id}
                  className={cn(
                    'flex flex-wrap items-center gap-3 rounded-lg border border-stone-200 bg-white p-3 focus-within:ring-2 focus-within:ring-primary',
                    session.id === selected?.id && 'border-primary bg-soft',
                    sessionStatus(session, now) === 'available' && !locked
                      ? 'cursor-pointer'
                      : 'cursor-default',
                  )}
                >
                  <input
                    type="radio"
                    name="workshop-session"
                    value={session.id}
                    checked={selected?.id === session.id}
                    disabled={
                      sessionStatus(session, now) !== 'available' || locked
                    }
                    onChange={() => {
                      setSelectedId(session.id);
                      setQuantity(1);
                      setError('');
                    }}
                    className="size-4 shrink-0 accent-primary"
                  />
                  {dateDetails(session)}
                  {selected?.price !== session.price && (
                    <span className="pl-7 text-sm tabular-nums text-stone-700">
                      {formatPrice(session.price)} đ / người
                    </span>
                  )}
                </label>
              ))}
            </fieldset>
          ) : (
            <p className="text-sm text-stone-700">
              Các buổi trước đã kết thúc. Studio chưa công bố lịch tiếp theo.
            </p>
          )}
          {sessions.length > 1 && !showOtherSessions && (
            <button
              type="button"
              className="min-h-11 text-sm font-semibold text-primary underline"
              onClick={() => setShowOtherSessions(true)}
            >
              Xem các buổi khác
            </button>
          )}
          {!initial && sessions.length === 0 && !confirmed && (
            <ScheduleNotification workshopId={workshop.id} />
          )}
          {selected && (
            <>
              <p className="text-sm text-stone-600">
                Chúng tôi dùng thông tin từ tài khoản của bạn để liên hệ.
              </p>
              <div
                role="group"
                aria-labelledby="booking-quantity-label"
                className="flex flex-wrap items-center justify-between gap-3 text-sm font-semibold"
              >
                <span id="booking-quantity-label">Số người</span>
                <div className="inline-flex items-center gap-1 rounded-lg border border-stone-300 bg-white p-1">
                  <button
                    type="button"
                    aria-label="Giảm số người"
                    aria-controls="booking-quantity"
                    disabled={locked || seats <= 1}
                    onClick={() => {
                      setQuantity(Math.max(1, seats - 1));
                      setError('');
                    }}
                    className="grid size-11 place-items-center rounded-md text-primary hover:bg-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:text-stone-400 disabled:hover:bg-transparent"
                  >
                    <Minus size={16} aria-hidden="true" />
                  </button>
                  <output
                    id="booking-quantity"
                    aria-label="Số người đã chọn"
                    aria-live="polite"
                    aria-atomic="true"
                    className="min-w-8 text-center tabular-nums"
                  >
                    {seats}
                  </output>
                  <button
                    type="button"
                    aria-label="Tăng số người"
                    aria-controls="booking-quantity"
                    disabled={
                      locked ||
                      seats >= bookingQuantityLimit(selected.availableSeats)
                    }
                    onClick={() => {
                      setQuantity(
                        clampBookingQuantity(
                          seats + 1,
                          selected.availableSeats,
                        ),
                      );
                      setError('');
                    }}
                    className="grid size-11 place-items-center rounded-md text-primary hover:bg-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:text-stone-400 disabled:hover:bg-transparent"
                  >
                    <Plus size={16} aria-hidden="true" />
                  </button>
                </div>
              </div>
              {depositMode === 'optional' ? (
                <fieldset disabled={locked} className="space-y-2">
                  <legend className="font-semibold">Cách thanh toán</legend>
                  {(['deposit', 'in_studio'] as const).map((value) => (
                    <label
                      key={value}
                      className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-stone-200 p-3"
                    >
                      <input
                        type="radio"
                        name="payment-choice"
                        checked={paymentChoice === value}
                        onChange={() => setChoice(value)}
                        className="accent-primary"
                      />
                      {value === 'deposit' ? 'Cọc trước' : 'Trả tại studio'}
                    </label>
                  ))}
                </fieldset>
              ) : (
                <p className="text-sm font-semibold">
                  {depositMode === 'required'
                    ? 'Cần đặt cọc để giữ chỗ'
                    : 'Trả tại studio'}
                </p>
              )}
              {paymentChoice === 'deposit' &&
                selected &&
                Date.parse(selected.startsAt) - now < 24 * 3600000 && (
                  <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-950">
                    Buổi học diễn ra trong vòng 24 giờ, khoản cọc sẽ không được
                    hoàn nếu bạn hủy.
                  </p>
                )}
              <div className="rounded-xl bg-soft p-4">
                <p className="text-sm text-stone-700">
                  {formatPrice(selected.price)} đ × {seats} người
                </p>
                <dl className="mt-3 space-y-2 text-sm">
                  <div className="flex justify-between gap-3">
                    <dt>Tổng tiền</dt>
                    <dd className="font-semibold tabular-nums">
                      {formatPrice(total!)} đ
                    </dd>
                  </div>
                  {depositAmount > 0 ? (
                    <>
                      <div className="flex justify-between gap-3 text-primary">
                        <dt className="font-semibold">
                          Đặt cọc ({depositPercent}%)
                        </dt>
                        <dd className="font-bold tabular-nums">
                          {formatPrice(depositAmount)} đ
                        </dd>
                      </div>
                      <div className="flex justify-between gap-3 border-t border-primary/15 pt-2">
                        <dt>Còn lại trả tại studio</dt>
                        <dd className="font-semibold tabular-nums">
                          {formatPrice(balanceAmount)} đ
                        </dd>
                      </div>
                      <p className="pt-1 text-xs leading-5 text-stone-600">
                        Sau khi đặt chỗ, bạn có 15 phút để quét mã QR đặt cọc.
                        Chỗ được xác nhận ngay khi chúng tôi nhận được tiền cọc.
                      </p>
                    </>
                  ) : (
                    <div className="flex justify-between gap-3 border-t border-primary/15 pt-2">
                      <dt>Trả tại studio</dt>
                      <dd className="font-semibold tabular-nums">
                        {formatPrice(total!)} đ
                      </dd>
                    </div>
                  )}
                </dl>
              </div>
              {paymentChoice === 'in_studio' && (
                <p className="text-sm text-stone-700">
                  Chỗ của bạn được xác nhận ngay. Bạn thanh toán trực tiếp tại
                  studio.
                </p>
              )}
            </>
          )}
          <button
            type="submit"
            disabled={!selected || locked}
            aria-describedby={error ? 'booking-error' : undefined}
            className={cn(primary, 'w-full')}
          >
            {pending
              ? 'Đang đặt chỗ…'
              : confirmed
                ? 'Đã đặt chỗ'
                : paymentChoice === 'deposit'
                  ? 'Đặt chỗ · Cọc ' + formatPrice(depositAmount) + ' đ'
                  : 'Đặt chỗ · Trả tại studio'}
          </button>
          {error && (
            <p id="booking-error" role="alert" className="text-sm text-brick">
              {error}
              {!onBook && (
                <>
                  {' '}
                  <Link
                    to={`/dang-nhap?redirect=${encodeURIComponent(locationPath.pathname + locationPath.search)}`}
                    className="font-semibold underline"
                  >
                    Đăng nhập để đặt chỗ
                  </Link>
                </>
              )}
            </p>
          )}
          {notice && (
            <p role="status" className="text-sm text-stone-700">
              {notice}
            </p>
          )}
          {confirmed && (
            <button
              type="button"
              onClick={saveCalendar}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-primary px-4 text-sm font-semibold text-primary hover:bg-primary hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
            >
              <CalendarPlus size={17} aria-hidden="true" />
              Thêm vào lịch
            </button>
          )}
        </form>
      </section>
      <div className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-between gap-4 bg-paper px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 lg:hidden">
        {total !== undefined && (
          <span className="flex min-w-0 flex-col">
            <span className="text-lg font-bold tabular-nums">
              {formatPrice(total)} đ
            </span>
            <span className="text-xs text-stone-600">
              {depositAmount > 0
                ? `Cọc ${formatPrice(depositAmount)} đ · còn ${formatPrice(balanceAmount)} đ tại studio`
                : 'Thanh toán tại studio'}
            </span>
          </span>
        )}
        <a
          href="#lich-trai-nghiem"
          onClick={() => heading.current?.focus({ preventScroll: true })}
          className={cn(primary, 'flex-1')}
        >
          {confirmed ? 'Xem đặt chỗ' : selected ? 'Chọn lịch' : 'Xem lịch'}
        </a>
      </div>
    </>
  );
}
