import { QRCodeSVG } from 'qrcode.react';
import { formatDate } from '@/lib/format';
import type { CustomerTicket } from '@/services/customerBookingService';

export interface BookingTicketsSectionProps {
  tickets: CustomerTicket[];
  isConfirmed: boolean;
  isCancelled: boolean;
  isExpired: boolean;
  sessionEnded: boolean;
}

export function BookingTicketsSection({
  tickets,
  isConfirmed,
  isCancelled,
  isExpired,
  sessionEnded,
}: BookingTicketsSectionProps) {
  return (
    <section className="mt-7" aria-labelledby="booking-tickets-title">
      <h2
        id="booking-tickets-title"
        className="font-heading text-xl font-semibold"
      >
        Vé tham gia
      </h2>
      {isConfirmed && tickets.length ? (
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
                <h3 className="font-semibold text-sm sm:text-base">
                  Vé số {ticket.seq}
                </h3>
                <p className="mt-1 text-sm">
                  {ticket.attendanceStatus === 'attended'
                    ? ticket.attendanceMethod === 'manual_confirmation'
                      ? 'Đã tham dự · Xác nhận thủ công'
                      : 'Đã tham dự'
                    : sessionEnded && ticket.attendanceStatus === 'unmarked'
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
          {isCancelled || isExpired
            ? 'Đặt chỗ này không có vé tham gia còn hiệu lực.'
            : 'Vé sẽ hiện ở đây sau khi chỗ của bạn được xác nhận.'}
        </p>
      )}
    </section>
  );
}
