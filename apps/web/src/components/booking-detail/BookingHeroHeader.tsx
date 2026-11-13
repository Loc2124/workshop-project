import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Calendar,
  CalendarPlus,
  Check,
  Copy,
  Hash,
  MapPin,
  Phone,
  Store,
  User,
  Users,
} from 'lucide-react';
import { bookingDisplayText } from '@/lib/display-text';
import { bookingScheduleLabel } from '@/lib/booking-detail';
import { formatPrice } from '@/lib/format';
import type { CustomerBooking } from '@/services/customerBookingService';

const secondary =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-line bg-surface px-4 text-sm font-semibold text-ink transition-colors hover:border-primary hover:text-primary disabled:opacity-60';
const money = (amount: number) => `${formatPrice(amount)} đ`;

export interface BookingHeroHeaderProps {
  booking: CustomerBooking;
  isCancelled: boolean;
  statusLabel?: string;
  statusToneClass?: string;
  actionNotice: string;
  onSetActionNotice: (notice: string) => void;
  onSaveCalendar: () => void;
}

export function BookingHeroHeader({
  booking,
  isCancelled,
  statusLabel,
  statusToneClass,
  actionNotice,
  onSetActionNotice,
  onSaveCalendar,
}: BookingHeroHeaderProps) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="rounded-xl border border-line bg-surface p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {statusLabel && (
            <span
              className={`mb-3 inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${statusToneClass ?? 'bg-primary/10 text-primary'}`}
            >
              {statusLabel}
            </span>
          )}
          <h1 className="font-heading text-2xl font-semibold break-words text-ink sm:text-3xl">
            {bookingDisplayText(booking.workshopTitle, 'Buổi học')}
          </h1>
          <Link
            className="mt-1 inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
            to={'/studios/' + (booking.studioSlug ?? booking.workshopId)}
          >
            <Store size={15} className="shrink-0" aria-hidden="true" />
            <span>{bookingDisplayText(booking.studioName, 'Studio')}</span>
          </Link>
        </div>
      </div>

      <p className="mt-2 inline-flex items-center gap-2 rounded-lg bg-soft px-3 py-2 text-sm font-semibold tabular-nums text-ink sm:text-base">
        <Calendar
          size={16}
          className="shrink-0 text-primary"
          aria-hidden="true"
        />
        <span>
          {bookingScheduleLabel(
            isCancelled && booking.bookedStartsAt
              ? booking.bookedStartsAt
              : booking.startsAt,
            isCancelled && booking.bookedEndsAt
              ? booking.bookedEndsAt
              : booking.endsAt,
          )}
        </span>
      </p>

      <dl className="mt-5 grid gap-4 rounded-xl border border-line/80 bg-paper/60 p-4 text-sm sm:grid-cols-2 sm:p-5">
        <div>
          <dt className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted">
            <Hash size={13} aria-hidden="true" />
            Mã đơn đặt chỗ
          </dt>
          <dd className="mt-1 font-mono text-base font-semibold text-ink">
            {booking.orderCode}
          </dd>
        </div>
        <div>
          <dt className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted">
            <Users size={13} aria-hidden="true" />
            Số người
          </dt>
          <dd className="mt-1 text-base font-semibold tabular-nums text-ink">
            {booking.quantity} chỗ
          </dd>
        </div>
        <div>
          <dt className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted">
            <User size={13} aria-hidden="true" />
            Người liên hệ
          </dt>
          <dd className="mt-1 text-ink">
            <span className="font-medium">
              {bookingDisplayText(booking.contactName, 'Khách tham gia')}
            </span>
            {booking.contactPhone && (
              <span className="mt-0.5 block tabular-nums text-stone-700">
                {booking.contactPhone}
              </span>
            )}
          </dd>
        </div>
        <div>
          <dt className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted">
            <MapPin size={13} aria-hidden="true" />
            Địa điểm
          </dt>
          <dd className="mt-1 break-words text-ink">
            {booking.address ?? booking.studioName}
          </dd>
        </div>
      </dl>

      {(booking.seatRevision ?? 0) > 0 && (
        <p className="mt-3 rounded-lg bg-soft px-3.5 py-2.5 text-sm text-stone-700">
          Ban đầu bạn đặt {booking.originalQuantity} chỗ, tổng{' '}
          {money(booking.originalTotalAmount ?? booking.totalAmount)}. Hiện còn{' '}
          {booking.remainingQuantity ?? booking.quantity} chỗ có hiệu lực.
        </p>
      )}

      {actionNotice && (
        <p role="status" className="mt-3 text-sm font-medium text-primary">
          {actionNotice}
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2.5">
        <button type="button" className={secondary} onClick={onSaveCalendar}>
          <CalendarPlus size={16} aria-hidden="true" />
          Thêm vào lịch
        </button>
        <button
          type="button"
          className={secondary}
          onClick={() =>
            void navigator.clipboard
              .writeText(String(booking.orderCode))
              .then(() => {
                setCopied(true);
                onSetActionNotice('Đã sao chép mã đặt chỗ.');
                window.setTimeout(() => setCopied(false), 1800);
              })
              .catch(() =>
                onSetActionNotice(
                  'Chưa sao chép được. Bạn có thể chọn mã đặt chỗ để sao chép.',
                ),
              )
          }
        >
          {copied ? (
            <Check
              size={16}
              className="text-studio-success"
              aria-hidden="true"
            />
          ) : (
            <Copy size={16} aria-hidden="true" />
          )}
          {copied ? 'Đã sao chép mã' : 'Sao chép mã đặt chỗ'}
        </button>
        {booking.studioContactPhone && (
          <a className={secondary} href={'tel:' + booking.studioContactPhone}>
            <Phone size={16} aria-hidden="true" />
            Liên hệ studio
          </a>
        )}
      </div>
    </div>
  );
}

export function BookingLocationSection({
  address,
}: {
  address?: string | null;
}) {
  return (
    <section
      className="mt-6 rounded-xl border border-line bg-surface p-5 sm:p-6"
      aria-label="Địa điểm và chính sách hủy"
    >
      {address && (
        <div className="mb-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-heading text-lg font-semibold text-ink">
              Bản đồ đường đi
            </h2>
            <a
              href={`https://maps.google.com/maps?q=${encodeURIComponent(address)}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-10 items-center text-sm font-semibold text-primary hover:underline"
            >
              Mở Google Maps
            </a>
          </div>
          <iframe
            title="Bản đồ studio"
            className="h-56 w-full rounded-xl border border-line"
            loading="lazy"
            referrerPolicy="no-referrer"
            src={
              'https://maps.google.com/maps?q=' +
              encodeURIComponent(address) +
              '&output=embed'
            }
          />
        </div>
      )}
      <p className="text-sm leading-6 text-stone-700">
        Hủy miễn phí trước giờ học 24h. Nếu bạn chưa đặt cọc, bạn có thể hủy bất
        cứ lúc nào.
      </p>
    </section>
  );
}
