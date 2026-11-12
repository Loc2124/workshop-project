import { CalendarClock } from 'lucide-react';
import { formatPrice } from '@/lib/core/format';
import { StudioBadge, StudioEmptyState } from '../StudioPrimitives';
import { dateLabel } from '@/pages/customer/CustomerBookingsPage';

export type UpcomingBooking = {
  bookingId: string;
  orderCode: string;
  workshopTitle: string;
  sessionStartsAt: string;
  sessionEndsAt: string | null;
  totalAmount: number;
  depositAmount: number;
  paidAmount: number;
  balanceAmount: number;
  paymentMode: string;
  isCompleted: boolean;
};

export function UpcomingBookingsTable({
  upcomingBookings,
}: {
  upcomingBookings: UpcomingBooking[];
}) {
  if (!upcomingBookings.length) {
    return (
      <StudioEmptyState
        icon={CalendarClock}
        title="Không có đơn cọc nào đang chờ"
        description="Khi khách đặt cọc tham gia workshop sắp tới, đơn sẽ hiển thị tại đây để bạn tiện theo dõi trước khi buổi học diễn ra."
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-studio-card border border-studio-border bg-studio-surface shadow-studio-card">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[800px] table-fixed border-collapse text-left">
          <colgroup>
            <col className="w-[20%]" />
            <col className="w-[22%]" />
            <col className="w-[18%]" />
            <col className="w-[20%]" />
            <col className="w-[20%]" />
          </colgroup>
          <thead className="bg-studio-subtle text-xs font-semibold uppercase tracking-wide text-studio-muted">
            <tr>
              <th className="px-4 py-3">Mã đơn / Workshop</th>
              <th className="px-3 py-3">Thời gian buổi học</th>
              <th className="px-3 py-3">Tiền cọc sàn giữ</th>
              <th className="px-3 py-3">Thu tại studio</th>
              <th className="px-4 py-3">Trạng thái buổi học</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-studio-border text-sm">
            {upcomingBookings.map((b) => (
              <tr
                key={b.bookingId}
                className="hover:bg-studio-selected/50 transition-colors"
              >
                <td className="px-4 py-4">
                  <p className="font-semibold text-studio-ink">
                    #{b.orderCode}
                  </p>
                  <p
                    className="mt-0.5 truncate text-xs text-studio-muted"
                    title={b.workshopTitle}
                  >
                    {b.workshopTitle}
                  </p>
                </td>
                <td className="px-3 py-4 text-xs text-studio-muted">
                  <time dateTime={b.sessionStartsAt}>
                    {dateLabel(b.sessionStartsAt)}
                  </time>
                </td>
                <td className="px-3 py-4">
                  <p className="font-semibold tabular-nums text-studio-ink">
                    {formatPrice(b.depositAmount)} đ
                  </p>
                  <p className="text-xs text-studio-muted">
                    {b.paidAmount >= b.depositAmount
                      ? 'Khách đã cọc thành công'
                      : 'Chờ cọc'}
                  </p>
                </td>
                <td className="px-3 py-4">
                  <p className="font-semibold tabular-nums text-studio-ink">
                    {formatPrice(b.balanceAmount)} đ
                  </p>
                </td>
                <td className="px-4 py-4">
                  {b.isCompleted ? (
                    <StudioBadge tone="warning">
                      Đã kết thúc (đang chốt)
                    </StudioBadge>
                  ) : (
                    <StudioBadge tone="neutral">Sắp diễn ra</StudioBadge>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
