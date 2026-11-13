import { Check, Copy, Phone } from 'lucide-react';
import { formatPrice } from '@/lib/format';
import {
  dateLabel,
  paymentLabel,
  reservationLabel,
} from '@/pages/customer/CustomerBookingsPage';
import { StudioBadge, StudioButton, StudioCard } from '../StudioPrimitives';

export interface BookingItemData {
  id: string;
  orderCode: string;
  quantity: number;
  contactName: string;
  contactPhone: string | null;
  totalAmount: number;
  paidAmount: number;
  depositAmount: number;
  paymentMode: string;
  refundStatus?: string;
  refundDueAmount?: number;
  refundedAmount?: number;
  reschedulePending?: boolean;
  seatRevision?: number;
  balanceAmount: number;
  reservationStatus: string;
  paymentStatus: string;
  startsAt: string;
  endsAt?: string;
  attendanceStatus?: string;
  workshopTitle: string;
}

export interface BookingCardItemProps {
  booking: BookingItemData;
  copiedId: string | null;
  onCopyOrderCode: (code: string) => void;
  isEligibleForCollection: boolean;
  isPaymentPending: boolean;
  onSelectForCollection: (booking: BookingItemData) => void;
}

export function paymentTone(status: string) {
  if (status === 'paid') return 'success' as const;
  if (status === 'pending' || status === 'refund_needed')
    return 'warning' as const;
  if (['cancelled', 'expired', 'failed'].includes(status))
    return 'danger' as const;
  return 'neutral' as const;
}

export function reservationTone(status: string) {
  if (status === 'confirmed' || status === 'completed')
    return 'success' as const;
  if (status === 'pending') return 'warning' as const;
  if (status === 'cancelled') return 'danger' as const;
  return 'neutral' as const;
}

export function BookingCardItem({
  booking,
  copiedId,
  onCopyOrderCode,
  isEligibleForCollection,
  isPaymentPending,
  onSelectForCollection,
}: BookingCardItemProps) {
  const remainingBalance = Math.max(
    0,
    booking.totalAmount - Math.max(booking.paidAmount, booking.depositAmount),
  );

  return (
    <li>
      <StudioCard
        className={`space-y-3.5 transition-colors duration-150 ${
          isEligibleForCollection ? 'border-amber-200 bg-amber-50/15' : ''
        }`}
      >
        <div className="flex items-start justify-between gap-2 border-b border-studio-border/60 pb-3">
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-bold text-studio-primary">
                #{booking.orderCode}
              </span>
              <button
                type="button"
                onClick={() => onCopyOrderCode(booking.orderCode)}
                className="text-studio-muted min-h-[32px] min-w-[32px] inline-flex items-center justify-center"
                title="Sao chép mã đơn"
              >
                {copiedId === booking.orderCode ? (
                  <Check className="size-3.5 text-emerald-600" />
                ) : (
                  <Copy className="size-3.5" />
                )}
              </button>
            </div>
            <h2 className="mt-1 font-heading text-base font-semibold text-studio-ink break-words">
              {booking.workshopTitle}
            </h2>
          </div>
          <p className="shrink-0 text-right font-bold tabular-nums text-studio-ink">
            {formatPrice(booking.totalAmount)} đ
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <span className="text-studio-muted">Khách hàng:</span>
            <p className="font-semibold text-studio-ink">
              {booking.contactName}
            </p>
            {booking.contactPhone && (
              <a
                href={`tel:${booking.contactPhone}`}
                className="mt-0.5 inline-flex items-center gap-1 text-studio-primary min-h-[28px]"
              >
                <Phone className="size-3" />
                {booking.contactPhone}
              </a>
            )}
          </div>

          <div>
            <span className="text-studio-muted">Buổi học:</span>
            <time
              className="mt-0.5 block font-medium text-studio-ink"
              dateTime={booking.startsAt}
            >
              {dateLabel(booking.startsAt)}
            </time>
          </div>

          <div>
            <span className="text-studio-muted">Số người:</span>
            <p className="font-medium tabular-nums text-studio-ink">
              {booking.quantity} người
            </p>
          </div>

          <div>
            <span className="text-studio-muted">
              {booking.paymentMode === 'payos_deposit'
                ? 'Cọc PayOS:'
                : 'Hình thức:'}
            </span>
            <p className="font-medium tabular-nums text-studio-ink">
              {booking.paymentMode === 'payos_deposit'
                ? `${formatPrice(booking.depositAmount)} đ (${booking.paidAmount >= booking.depositAmount ? 'Đã nhận' : 'Chờ'})`
                : 'Tại studio'}
            </p>
          </div>

          {booking.paymentMode === 'payos_deposit' && (
            <div className="col-span-2 rounded-md bg-amber-50/70 p-2 border border-amber-200/60">
              <span className="text-amber-900">Còn lại thu tại studio:</span>
              <span className="float-right font-bold tabular-nums text-amber-900">
                {formatPrice(remainingBalance)} đ
              </span>
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          <StudioBadge tone={reservationTone(booking.reservationStatus)}>
            {booking.reschedulePending
              ? 'Chờ khách xác nhận giờ mới'
              : reservationLabel(booking.reservationStatus)}
          </StudioBadge>
          <StudioBadge tone={paymentTone(booking.paymentStatus)}>
            {paymentLabel(booking.paymentStatus)}
          </StudioBadge>
        </div>

        {isEligibleForCollection && (
          <StudioButton
            className="w-full border-amber-300 bg-amber-100 text-amber-950 hover:bg-amber-200 min-h-11"
            disabled={isPaymentPending}
            onClick={() => onSelectForCollection(booking)}
            type="button"
            variant="secondary"
          >
            Ghi nhận thu {formatPrice(booking.balanceAmount)} đ
          </StudioButton>
        )}
      </StudioCard>
    </li>
  );
}
