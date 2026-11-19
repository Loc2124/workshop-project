import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatDate, formatPrice } from '@/lib/format';
import type { CheckInTicket, CheckInBusyState } from '../types';

interface TicketCheckInCardProps {
  ticket: CheckInTicket;
  manualReason: string;
  onManualReasonChange: (reason: string) => void;
  busy: CheckInBusyState;
  onConfirm: () => void;
  onRecordPayment: () => void;
}

export function TicketCheckInCard({
  ticket,
  manualReason,
  onManualReasonChange,
  busy,
  onConfirm,
  onRecordPayment,
}: TicketCheckInCardProps) {
  return (
    <section
      className="rounded-2xl border border-line bg-surface p-4 sm:p-6"
      aria-label="Thông tin vé"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line pb-4">
        <div>
          <p className="text-sm text-muted">
            Vé số {ticket.ticketNumber} · {ticket.checkedInCount}/
            {ticket.quantity} người đã check-in
          </p>
          <h2 className="mt-1 font-heading text-xl font-semibold">
            {ticket.workshopTitle}
          </h2>
          <p className="mt-1 text-sm">{formatDate(ticket.startsAt)}</p>
        </div>
        <span className="rounded-full border border-line px-3 py-1 text-sm font-medium">
          {ticket.attendanceStatus === 'attended'
            ? ticket.attendanceMethod === 'manual_confirmation'
              ? 'Đã tham dự · Xác nhận thủ công'
              : 'Đã tham dự'
            : ticket.ticketStatus === 'void' ||
                ticket.reservationStatus === 'cancelled'
              ? 'Vé đã hủy'
              : ticket.attendanceStatus === 'absent'
                ? 'Đã ghi vắng'
                : Date.parse(ticket.serverNow) >= Date.parse(ticket.endsAt) &&
                    ticket.attendanceStatus === 'unmarked'
                  ? 'Đã qua buổi · Chưa check-in'
                  : ticket.ticketStatus === 'used'
                    ? 'Vé đã sử dụng'
                    : 'Chưa check-in'}
        </span>
      </div>

      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted">Khách đặt</dt>
          <dd className="font-medium">{ticket.customerName}</dd>
        </div>
        <div>
          <dt className="text-muted">Số người trong đặt chỗ</dt>
          <dd className="font-medium">{ticket.quantity}</dd>
        </div>
        <div>
          <dt className="text-muted">
            {ticket.remainingAmount > 0
              ? 'Còn phải trả tại studio'
              : 'Đã thu tại studio'}
          </dt>
          <dd
            className={`font-semibold tabular-nums ${
              ticket.remainingAmount === 0 ? 'text-emerald-700' : ''
            }`}
          >
            {ticket.remainingAmount > 0
              ? `${formatPrice(ticket.remainingAmount)} đ`
              : `${formatPrice(
                  ticket.inStudioAmount ??
                    (ticket.totalAmount
                      ? ticket.totalAmount - (ticket.depositAmount ?? 0)
                      : 0),
                )} đ`}
          </dd>
        </div>
        <div>
          <dt className="text-muted">Thanh toán</dt>
          <dd className="font-medium">
            {ticket.remainingAmount > 0 ? (
              <span className="font-semibold text-amber-700">Chưa thu đủ</span>
            ) : (
              <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                <Check className="size-3.5 text-emerald-600" />
                Đã thu đủ tại studio (
                {formatPrice(
                  ticket.inStudioAmount ??
                    (ticket.totalAmount
                      ? ticket.totalAmount - (ticket.depositAmount ?? 0)
                      : 0),
                )}{' '}
                đ)
              </span>
            )}
          </dd>
        </div>
      </dl>

      {ticket.attendanceStatus === 'attended' && ticket.checkedInAt && (
        <p className="mt-4 border-t border-line pt-4 text-sm">
          {ticket.attendanceMethod === 'manual_confirmation'
            ? 'Đã tham dự, xác nhận thủ công lúc '
            : 'Đã check-in lúc '}
          {formatDate(ticket.checkedInAt)}
          {ticket.checkedInBy ? ` bởi ${ticket.checkedInBy}` : ''}.
        </p>
      )}

      {ticket.remainingAmount > 0 &&
        ticket.ticketStatus !== 'void' &&
        !ticket.reschedulePending &&
        ticket.sessionStatus === 'scheduled' &&
        ['confirmed', 'completed'].includes(ticket.reservationStatus) && (
          <div className="mt-5 border-t border-line pt-4">
            <p className="mb-3 text-sm text-muted">
              Chỉ ghi nhận thanh toán sau khi thực sự nhận đủ tiền. Thao tác này
              không check-in vé.
            </p>
            <Button
              type="button"
              variant="outline"
              disabled={busy !== null}
              onClick={onRecordPayment}
            >
              {busy === 'payment'
                ? 'Đang ghi nhận…'
                : `Đã thu ${formatPrice(ticket.remainingAmount)} đ — ghi nhận thanh toán`}
            </Button>
          </div>
        )}

      {ticket.canCheckIn ? (
        <div className="mt-5 border-t border-line pt-4">
          <p className="mb-3 text-sm text-muted">
            Đối chiếu khách và giờ học trước khi xác nhận. Check-in không thay
            đổi thanh toán.
          </p>
          <Button type="button" disabled={busy !== null} onClick={onConfirm}>
            {busy === 'check-in' ? 'Đang xác nhận…' : 'Xác nhận check-in'}
          </Button>
        </div>
      ) : ticket.canConfirmManually ? (
        <div className="mt-5 border-t border-line pt-4">
          <p className="mb-3 text-sm text-muted">
            Buổi học đã kết thúc. Chỉ xác nhận nếu đã đối chiếu được rằng khách
            thực sự tham dự; thao tác sẽ lưu người xác nhận và lý do.
          </p>
          <label className="block text-sm font-medium">
            Lý do xác nhận đã tham dự
            <textarea
              className="mt-2 min-h-24 w-full rounded-lg border border-line bg-paper p-3"
              value={manualReason}
              onChange={(event) => onManualReasonChange(event.target.value)}
              maxLength={1000}
              required
            />
          </label>
          <Button
            type="button"
            className="mt-3"
            disabled={busy !== null || manualReason.trim().length < 3}
            onClick={onConfirm}
          >
            {busy === 'check-in' ? 'Đang xác nhận…' : 'Xác nhận đã tham dự'}
          </Button>
        </div>
      ) : (
        ticket.attendanceStatus === 'unmarked' && (
          <p className="mt-5 border-t border-line pt-4 text-sm text-brick">
            {Date.parse(ticket.serverNow) < Date.parse(ticket.startsAt)
              ? 'Chỉ check-in từ giờ bắt đầu buổi học.'
              : Date.parse(ticket.serverNow) >= Date.parse(ticket.endsAt)
                ? 'Buổi đã qua. QR hết hiệu lực; dùng mã 8 ký tự và xác nhận thủ công nếu đã đối chiếu khách thực sự tham dự.'
                : 'Vé chưa đủ điều kiện check-in. Kiểm tra trạng thái đặt chỗ và lịch học.'}
          </p>
        )
      )}
    </section>
  );
}
