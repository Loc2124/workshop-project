import { useRef, useState, type FormEvent } from 'react';
import { CalendarDays, CalendarPlus, MapPin, Minus, Plus } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import type { Workshop, WorkshopSession } from '../../types/workshop';
import { formatPrice } from '../../lib/format';
import { sessionCalendar, upcomingSessions } from '../../lib/workshopDetails';
import { cn } from '../../lib/utils';
import { WorkshopRating } from './WorkshopRating';
import { workshopText, workshopSessionRange } from './workshopPresentation';
import { bookingFormSchema } from '../../lib/form-validation';
import { toast } from 'sonner';

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
  const sessions = upcomingSessions(workshop.sessions).filter(
    (session) =>
      Number.isFinite(session.price) &&
      session.price >= 0 &&
      Number.isInteger(session.availableSeats) &&
      session.availableSeats >= 0,
  );
  const initial = sessions.find((session) => session.availableSeats > 0);
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
      (session) => session.id === selectedId && session.availableSeats > 0,
    ) ??
    initial;
  const seats =
    confirmed?.quantity ??
    (selected ? clampBookingQuantity(quantity, selected.availableSeats) : 0);
  const total = selected ? selected.price * seats : undefined;
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
      const result = await onBook(parsed.data);
      if (!result?.id?.trim()) throw new Error('Missing booking confirmation');
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
          : session.availableSeats > 0
            ? 'Còn ' + session.availableSeats + ' chỗ'
            : 'Đã hết chỗ'}
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
          {confirmed || sessions.length === 1 ? (
            <div className="rounded-xl bg-soft p-4">
              {dateDetails(confirmed?.session ?? sessions[0])}
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
                    session.availableSeats > 0 && !locked
                      ? 'cursor-pointer'
                      : 'cursor-default',
                  )}
                >
                  <input
                    type="radio"
                    name="workshop-session"
                    value={session.id}
                    checked={selected?.id === session.id}
                    disabled={session.availableSeats < 1 || locked}
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
              Workshop chưa có lịch sắp tới.
            </p>
          )}
          {selected && (
            <>
              <p className="text-sm text-stone-600">
                Thông tin liên hệ được lấy từ tài khoản đã đăng nhập.
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
              <div className="rounded-xl bg-soft p-4">
                <p className="text-sm text-stone-700">
                  {formatPrice(selected.price)} đ × {seats} người
                </p>
                <dl className="mt-2 flex flex-wrap items-baseline justify-between gap-2">
                  <dt className="text-sm font-semibold">Tổng tiền</dt>
                  <dd className="text-3xl font-bold tabular-nums">
                    {formatPrice(total!)} đ
                  </dd>
                </dl>
                <p className="mt-2 text-sm text-stone-700">
                  Studio đủ điều kiện sẽ thu tiền cọc qua cổng thanh toán; các
                  trường hợp còn lại thanh toán tại studio. Số tiền cần trả được
                  xác nhận sau khi đặt chỗ.
                </p>
              </div>
            </>
          )}
          <button
            type="submit"
            disabled={!selected || locked}
            aria-describedby={error ? 'booking-error' : undefined}
            className={cn(primary, 'w-full')}
          >
            {pending ? 'Đang đặt chỗ…' : confirmed ? 'Đã đặt chỗ' : 'Đặt chỗ'}
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
          <span className="text-lg font-bold tabular-nums">
            {formatPrice(total)} đ
          </span>
        )}
        <a
          href="#lich-trai-nghiem"
          onClick={() => heading.current?.focus({ preventScroll: true })}
          className={cn(primary, 'flex-1')}
        >
          {confirmed ? 'Xem đặt chỗ' : 'Đặt chỗ'}
        </a>
      </div>
    </>
  );
}
