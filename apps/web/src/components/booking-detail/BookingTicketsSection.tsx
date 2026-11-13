import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  Check,
  CheckCircle2,
  Copy,
  Maximize2,
  QrCode,
  Ticket,
} from 'lucide-react';
import { formatDate } from '@/lib/format';
import type { CustomerTicket } from '@/services/customerBookingService';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '../ui/dialog';

export interface BookingTicketsSectionProps {
  tickets: CustomerTicket[];
  isConfirmed: boolean;
  isCancelled: boolean;
  isExpired: boolean;
  sessionEnded: boolean;
}

function ticketStatusMeta(ticket: CustomerTicket, sessionEnded: boolean) {
  if (ticket.attendanceStatus === 'attended') {
    return {
      label:
        ticket.attendanceMethod === 'manual_confirmation'
          ? 'Đã tham dự · Xác nhận thủ công'
          : 'Đã tham dự',
      tone: 'bg-studio-success-soft text-studio-success',
    };
  }
  if (sessionEnded && ticket.attendanceStatus === 'unmarked') {
    return {
      label: 'Đã qua buổi · Chưa check-in',
      tone: 'bg-studio-neutral-soft text-studio-neutral',
    };
  }
  if (ticket.attendanceStatus === 'absent') {
    return {
      label: 'Vắng mặt',
      tone: 'bg-studio-danger-soft text-studio-danger',
    };
  }
  if (ticket.status === 'valid') {
    return {
      label: 'Còn hiệu lực',
      tone: 'bg-studio-success-soft text-studio-success',
    };
  }
  if (ticket.status === 'used') {
    return {
      label: 'Đã sử dụng',
      tone: 'bg-studio-neutral-soft text-studio-neutral',
    };
  }
  return {
    label: 'Đã vô hiệu',
    tone: 'bg-studio-neutral-soft text-studio-neutral',
  };
}

export function BookingTicketsSection({
  tickets,
  isConfirmed,
  isCancelled,
  isExpired,
  sessionEnded,
}: BookingTicketsSectionProps) {
  const [zoomedTicket, setZoomedTicket] = useState<CustomerTicket | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const copyManualCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      window.setTimeout(() => setCopiedCode(null), 1800);
    } catch {
      setCopiedCode(null);
    }
  };

  return (
    <section className="mt-6" aria-labelledby="booking-tickets-title">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2
          id="booking-tickets-title"
          className="flex items-center gap-2 font-heading text-xl font-semibold text-ink"
        >
          <Ticket size={20} className="text-primary" aria-hidden="true" />
          <span>Vé tham gia</span>
        </h2>
        {isConfirmed && tickets.length > 0 && (
          <span className="text-sm font-medium text-muted tabular-nums">
            {tickets.length} vé
          </span>
        )}
      </div>

      {isConfirmed && tickets.length ? (
        <ul className="mt-3 grid gap-4 sm:grid-cols-2">
          {tickets.map((ticket) => {
            const status = ticketStatusMeta(ticket, sessionEnded);
            const isAttended = ticket.attendanceStatus === 'attended';
            const showQr =
              !sessionEnded && ticket.status === 'valid' && !isAttended;
            return (
              <li
                key={ticket.id}
                className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-line bg-surface"
              >
                <div className="flex items-center justify-between gap-2 border-b border-dashed border-line bg-soft/60 px-4 py-3">
                  <h3 className="font-heading text-base font-semibold text-ink">
                    Vé số {ticket.seq}
                  </h3>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${status.tone}`}
                  >
                    {status.label}
                  </span>
                </div>

                <div className="flex flex-1 flex-col gap-4 p-4">
                  <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
                    {showQr && (
                      <div className="flex shrink-0 flex-col items-center gap-2">
                        <div className="rounded-xl border border-line bg-white p-2.5">
                          <QRCodeSVG
                            value={`OS-TICKET:${ticket.code}`}
                            size={120}
                            title={`Mã QR vé tham gia ${ticket.seq}`}
                            className="block"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => setZoomedTicket(ticket)}
                          className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-line bg-paper px-3 text-xs font-semibold text-ink transition-colors hover:border-primary hover:text-primary"
                        >
                          <Maximize2 size={13} aria-hidden="true" />
                          Phóng to QR
                        </button>
                      </div>
                    )}

                    <div className="min-w-0 flex-1 space-y-2.5 text-center sm:text-left">
                      {showQr && (
                        <p className="text-xs leading-5 text-stone-700">
                          Xuất trình mã QR này tại studio trước giờ kết thúc
                          buổi học để check-in.
                        </p>
                      )}
                      {sessionEnded && ticket.status === 'valid' && (
                        <p className="text-xs leading-5 text-stone-600">
                          QR đã hết hiệu lực sau giờ kết thúc buổi học.
                        </p>
                      )}
                      {isAttended && (
                        <div className="flex items-start gap-2 rounded-lg bg-studio-success-soft/60 p-3 text-left text-xs leading-5 text-studio-success">
                          <CheckCircle2
                            size={16}
                            className="mt-0.5 shrink-0"
                            aria-hidden="true"
                          />
                          <p>
                            {ticket.attendanceMarkedAt
                              ? `Đã check-in lúc ${formatDate(ticket.attendanceMarkedAt)}`
                              : 'Đã ghi nhận tham dự'}
                            {ticket.attendanceMarkedBy
                              ? ` bởi ${ticket.attendanceMarkedBy}`
                              : ''}
                            .
                          </p>
                        </div>
                      )}
                      {ticket.manualCode &&
                        ticket.status === 'valid' &&
                        ticket.attendanceStatus === 'unmarked' && (
                          <div className="rounded-lg border border-dashed border-line bg-paper px-3 py-2 text-left">
                            <p className="text-[11px] font-medium uppercase tracking-wide text-muted">
                              Mã nhập tay
                            </p>
                            <div className="mt-1 flex items-center justify-between gap-2">
                              <span className="font-mono text-sm font-bold tracking-widest text-ink">
                                {ticket.manualCode}
                              </span>
                              <button
                                type="button"
                                aria-label={`Sao chép mã vé ${ticket.seq}`}
                                onClick={() =>
                                  void copyManualCode(ticket.manualCode!)
                                }
                                className="inline-flex min-h-9 shrink-0 items-center gap-1 rounded-md border border-line bg-surface px-2.5 text-xs font-semibold text-stone-700 hover:border-primary hover:text-primary"
                              >
                                {copiedCode === ticket.manualCode ? (
                                  <Check
                                    size={13}
                                    className="text-studio-success"
                                    aria-hidden="true"
                                  />
                                ) : (
                                  <Copy size={13} aria-hidden="true" />
                                )}
                                {copiedCode === ticket.manualCode
                                  ? 'Đã chép'
                                  : 'Chép'}
                              </button>
                            </div>
                          </div>
                        )}
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="mt-3 rounded-xl border border-dashed border-line bg-surface p-6 text-center">
          <QrCode size={24} className="mx-auto text-muted" aria-hidden="true" />
          <p className="mt-2 text-sm text-stone-700">
            {isCancelled || isExpired
              ? 'Đặt chỗ này không có vé tham gia còn hiệu lực.'
              : 'Vé QR sẽ hiện ở đây ngay sau khi chỗ của bạn được xác nhận.'}
          </p>
        </div>
      )}

      <Dialog
        open={Boolean(zoomedTicket)}
        onOpenChange={(open) => {
          if (!open) setZoomedTicket(null);
        }}
      >
        <DialogContent className="max-w-sm bg-surface p-6 text-center">
          <DialogTitle className="font-heading text-xl font-semibold text-ink">
            Vé số {zoomedTicket?.seq}
          </DialogTitle>
          <DialogDescription className="mt-1 text-sm text-muted">
            Đưa mã QR này cho nhân viên studio để quét check-in.
          </DialogDescription>
          {zoomedTicket && (
            <div className="mt-5 flex flex-col items-center gap-4">
              <div className="rounded-2xl border border-line bg-white p-4">
                <QRCodeSVG
                  value={`OS-TICKET:${zoomedTicket.code}`}
                  size={224}
                  title={`Mã QR phóng to vé ${zoomedTicket.seq}`}
                />
              </div>
              {zoomedTicket.manualCode && (
                <div className="w-full rounded-lg border border-dashed border-line bg-paper px-4 py-2.5">
                  <p className="text-xs text-muted">Mã nhập tay</p>
                  <p className="mt-0.5 font-mono text-lg font-bold tracking-widest text-ink">
                    {zoomedTicket.manualCode}
                  </p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
