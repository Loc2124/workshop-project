import { Link } from 'react-router-dom';
import { bookingDisplayText } from '../../lib/display-text';
import { bookingScheduleLabel } from '../../lib/booking-detail';
import { formatPrice } from '../../lib/format';
import type { CustomerBooking } from '../../services/customerBookingService';

const secondary =
  'inline-flex min-h-11 items-center justify-center rounded-lg border border-primary px-4 text-sm font-semibold text-primary hover:bg-soft disabled:opacity-60';
const money = (amount: number) => `${formatPrice(amount)} đ`;

export interface BookingHeroHeaderProps {
  booking: CustomerBooking;
  isCancelled: boolean;
  actionNotice: string;
  onSetActionNotice: (notice: string) => void;
  onSaveCalendar: () => void;
}

export function BookingHeroHeader({
  booking,
  isCancelled,
  actionNotice,
  onSetActionNotice,
  onSaveCalendar,
}: BookingHeroHeaderProps) {
  return (
    <div>
      <h1 className="font-heading text-2xl sm:text-3xl font-semibold break-words">
        {bookingDisplayText(booking.workshopTitle, 'Buổi học')}
      </h1>
      <Link
        className="mt-2 inline-block min-h-11 text-primary underline"
        to={'/studios/' + (booking.studioSlug ?? booking.workshopId)}
      >
        Studio: {bookingDisplayText(booking.studioName, 'Studio')}
      </Link>
      <p className="mt-2 font-semibold tabular-nums text-sm sm:text-base">
        {bookingScheduleLabel(
          isCancelled && booking.bookedStartsAt
            ? booking.bookedStartsAt
            : booking.startsAt,
          isCancelled && booking.bookedEndsAt
            ? booking.bookedEndsAt
            : booking.endsAt,
        )}
      </p>
      <dl className="mt-5 grid gap-4 rounded-xl bg-surface p-4 sm:p-5 text-sm sm:grid-cols-2">
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
          <dd className="mt-1 break-words">{booking.address ?? booking.studioName}</dd>
        </div>
      </dl>
      {(booking.seatRevision ?? 0) > 0 && (
        <p className="mt-3 text-sm text-stone-700">
          Ban đầu bạn đặt {booking.originalQuantity} chỗ, tổng{' '}
          {money(booking.originalTotalAmount ?? booking.totalAmount)}. Hiện còn{' '}
          {booking.remainingQuantity ?? booking.quantity} chỗ có hiệu lực.
        </p>
      )}
      {actionNotice && (
        <p role="status" className="mt-2 text-sm text-primary">
          {actionNotice}
        </p>
      )}
      <div className="mt-4 flex flex-wrap gap-3">
        <button type="button" className={secondary} onClick={onSaveCalendar}>
          Thêm vào lịch
        </button>
        <button
          type="button"
          className={secondary}
          onClick={() =>
            void navigator.clipboard
              .writeText(String(booking.orderCode))
              .then(() => onSetActionNotice('Đã sao chép mã đặt chỗ.'))
              .catch(() =>
                onSetActionNotice(
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
        Hủy miễn phí trước giờ học 24h. Nếu bạn chưa đặt cọc, bạn có thể hủy bất
        cứ lúc nào.
      </p>
    </div>
  );
}
