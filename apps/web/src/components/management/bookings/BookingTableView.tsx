import { Check, Copy, Phone, CalendarClock, UsersRound } from 'lucide-react';
import { formatPrice } from '@/lib/format';
import {
  dateLabel,
  paymentLabel,
  reservationLabel,
} from '@/pages/customer/CustomerBookingsPage';
import { StudioBadge, StudioButton } from '../StudioPrimitives';
import {
  paymentTone,
  reservationTone,
  type BookingItemData,
} from './BookingCardItem';

export interface BookingTableViewProps {
  bookings: BookingItemData[];
  copiedId: string | null;
  onCopyOrderCode: (code: string) => void;
  isEligibleForCollection: (booking: BookingItemData) => boolean;
  isPaymentPending: boolean;
  onSelectForCollection: (booking: BookingItemData) => void;
}

export function BookingTableView({
  bookings,
  copiedId,
  onCopyOrderCode,
  isEligibleForCollection,
  isPaymentPending,
  onSelectForCollection,
}: BookingTableViewProps) {
  return (
    <div className="hidden overflow-hidden rounded-studio-card border border-studio-border bg-studio-surface shadow-studio-card md:block">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1080px] table-fixed border-collapse text-left">
          <colgroup>
            <col className="w-[17%]" />
            <col className="w-[14%]" />
            <col className="w-[18%]" />
            <col className="w-[8%]" />
            <col className="w-[18%]" />
            <col className="w-[13%]" />
            <col className="w-[12%]" />
          </colgroup>
          <thead className="border-b border-studio-border bg-studio-subtle text-xs font-semibold uppercase tracking-wider text-studio-muted">
            <tr>
              <th className="px-4 py-3.5">Mã đơn / Workshop</th>
              <th className="px-3 py-3.5">Khách hàng</th>
              <th className="px-3 py-3.5">Thời gian buổi học</th>
              <th className="px-2 py-3.5 text-center">Số người</th>
              <th className="px-3 py-3.5">Thanh toán & Thu tiền</th>
              <th className="px-3 py-3.5">Trạng thái</th>
              <th className="px-4 py-3.5 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-studio-border/70 text-sm">
            {bookings.map((booking) => {
              const needsCollection = isEligibleForCollection(booking);
              const remainingBalance = Math.max(
                0,
                booking.totalAmount -
                  Math.max(booking.paidAmount, booking.depositAmount),
              );

              return (
                <tr
                  key={booking.id}
                  className={`transition-colors duration-150 hover:bg-studio-selected/50 ${
                    needsCollection ? 'bg-amber-50/20' : ''
                  }`}
                >
                  <td className="px-4 py-4 align-top">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-studio-ink">
                        #{booking.orderCode}
                      </span>
                      <button
                        type="button"
                        onClick={() => onCopyOrderCode(booking.orderCode)}
                        className="text-studio-muted hover:text-studio-ink"
                        title="Sao chép mã đơn"
                      >
                        {copiedId === booking.orderCode ? (
                          <Check className="size-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="size-3.5" />
                        )}
                      </button>
                    </div>
                    <p
                      className="mt-1 line-clamp-2 text-xs font-medium text-studio-muted"
                      title={booking.workshopTitle}
                    >
                      {booking.workshopTitle}
                    </p>
                  </td>

                  <td className="px-3 py-4 align-top">
                    <p className="font-semibold text-studio-ink">
                      {booking.contactName}
                    </p>
                    {booking.contactPhone ? (
                      <a
                        href={`tel:${booking.contactPhone}`}
                        className="mt-1 inline-flex items-center gap-1 text-xs text-studio-muted hover:text-studio-primary hover:underline"
                      >
                        <Phone className="size-3" />
                        {booking.contactPhone}
                      </a>
                    ) : (
                      <span className="mt-1 block text-xs text-studio-muted/70">
                        Chưa có SĐT
                      </span>
                    )}
                  </td>

                  <td className="px-3 py-4 align-top">
                    <span className="inline-flex items-start gap-1.5 text-xs text-studio-ink">
                      <CalendarClock
                        aria-hidden="true"
                        className="mt-0.5 size-4 shrink-0 text-studio-muted"
                      />
                      <time dateTime={booking.startsAt}>
                        {dateLabel(booking.startsAt)}
                      </time>
                    </span>
                  </td>

                  <td className="px-2 py-4 text-center align-top">
                    <span className="inline-flex items-center justify-center gap-1 text-sm font-semibold tabular-nums text-studio-ink">
                      <UsersRound
                        aria-hidden="true"
                        className="size-3.5 text-studio-muted"
                      />
                      {booking.quantity}
                    </span>
                  </td>

                  <td className="px-3 py-4 align-top">
                    <p className="font-semibold tabular-nums text-studio-ink">
                      {formatPrice(booking.totalAmount)} đ
                    </p>
                    {booking.paymentMode === 'payos_deposit' ? (
                      <div className="mt-1 space-y-0.5 text-xs text-studio-muted">
                        <p className="tabular-nums">
                          Cọc PayOS:{' '}
                          <span className="font-medium text-studio-ink">
                            {formatPrice(booking.depositAmount)} đ
                          </span>{' '}
                          ·{' '}
                          {booking.paidAmount >= booking.depositAmount ? (
                            <span className="text-emerald-700 font-medium">
                              Đã nhận cọc
                            </span>
                          ) : (
                            <span className="text-amber-700 font-medium">
                              Chờ khách cọc
                            </span>
                          )}
                        </p>
                        <p className="tabular-nums">
                          Thu tại xưởng:{' '}
                          <span
                            className={`font-semibold ${
                              remainingBalance > 0 &&
                              booking.paymentStatus === 'pending'
                                ? 'text-amber-800'
                                : 'text-studio-ink'
                            }`}
                          >
                            {formatPrice(remainingBalance)} đ
                          </span>
                        </p>
                      </div>
                    ) : (
                      <p className="mt-1 text-xs text-studio-muted">
                        Thu toàn bộ tại xưởng
                      </p>
                    )}
                  </td>

                  <td className="px-3 py-4 align-top">
                    <div className="flex flex-col items-start gap-1.5">
                      <StudioBadge
                        tone={reservationTone(booking.reservationStatus)}
                      >
                        {booking.reschedulePending
                          ? 'Chờ khách xác nhận giờ mới'
                          : reservationLabel(booking.reservationStatus)}
                      </StudioBadge>
                      <StudioBadge tone={paymentTone(booking.paymentStatus)}>
                        {paymentLabel(booking.paymentStatus)}
                      </StudioBadge>
                    </div>
                  </td>

                  <td className="px-4 py-4 text-right align-top">
                    {needsCollection ? (
                      <StudioButton
                        aria-label={`Ghi nhận thu ${formatPrice(booking.balanceAmount)} đồng cho đơn #${booking.orderCode}`}
                        disabled={isPaymentPending}
                        onClick={() => onSelectForCollection(booking)}
                        type="button"
                        variant="secondary"
                        className="border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100"
                      >
                        Ghi nhận
                      </StudioButton>
                    ) : (
                      <span className="text-sm text-studio-muted">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
