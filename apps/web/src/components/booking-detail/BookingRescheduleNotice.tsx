import { formatDate } from '../../lib/format';
import { bookingScheduleLabel } from '../../lib/booking-detail';
import type { CustomerBooking } from '../../services/customerBookingService';

const primary =
  'inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-white hover:bg-primary-hover disabled:cursor-wait disabled:opacity-60';
const secondary =
  'inline-flex min-h-11 items-center justify-center rounded-lg border border-primary px-4 text-sm font-semibold text-primary hover:bg-soft disabled:opacity-60';

export interface BookingRescheduleNoticeProps {
  booking: CustomerBooking;
  now: number;
  isAcceptPending: boolean;
  acceptErrorMessage?: string;
  onAcceptSchedule: () => void;
  onRequestCancel: (event: React.MouseEvent<HTMLButtonElement>) => void;
}

export function BookingRescheduleNotice({
  booking,
  now,
  isAcceptPending,
  acceptErrorMessage,
  onAcceptSchedule,
  onRequestCancel,
}: BookingRescheduleNoticeProps) {
  const isDeadlinePassed =
    !!booking.rescheduleDeadline &&
    now >= Date.parse(booking.rescheduleDeadline);

  return (
    <section
      aria-label="Thay đổi giờ học"
      className="mb-5 rounded-lg border border-primary/25 bg-soft p-4 text-sm leading-6"
    >
      <h2 className="font-heading text-lg sm:text-xl font-semibold">
        Studio đã đổi giờ học
      </h2>
      {booking.bookedStartsAt && booking.bookedEndsAt && (
        <p className="mt-3 text-stone-600">
          Giờ cũ:{' '}
          {bookingScheduleLabel(booking.bookedStartsAt, booking.bookedEndsAt)}
        </p>
      )}
      <p className="mt-1 font-semibold">
        Giờ mới: {bookingScheduleLabel(booking.startsAt, booking.endsAt)}
      </p>
      {booking.rescheduleDeadline && (
        <p className="mt-3">
          Vui lòng phản hồi trước{' '}
          <strong>{formatDate(booking.rescheduleDeadline)}</strong>.
        </p>
      )}
      <p className="mt-2">
        Bạn có thể giữ chỗ theo giờ mới hoặc hủy để được hoàn toàn bộ số tiền đã
        trả. Nếu không phản hồi đúng hạn, đặt chỗ sẽ tự hủy.
      </p>
      <button
        type="button"
        className={primary + ' mt-4'}
        disabled={
          isAcceptPending || !booking.scheduleVersion || isDeadlinePassed
        }
        aria-busy={isAcceptPending}
        onClick={onAcceptSchedule}
      >
        {isAcceptPending ? 'Đang xác nhận…' : 'Giữ chỗ theo giờ mới'}
      </button>
      <button
        type="button"
        className={secondary + ' mt-2 w-full'}
        onClick={onRequestCancel}
      >
        Hủy đặt chỗ
      </button>
      {acceptErrorMessage && (
        <p role="alert" className="mt-3 text-brick">
          {acceptErrorMessage}
        </p>
      )}
      {isDeadlinePassed && (
        <p role="status" className="mt-3 text-stone-600">
          Đã hết hạn phản hồi. Đang cập nhật đặt chỗ…
        </p>
      )}
    </section>
  );
}
