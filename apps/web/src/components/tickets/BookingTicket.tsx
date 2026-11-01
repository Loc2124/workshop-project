import { createPortal } from 'react-dom';
import { QRCodeSVG } from 'qrcode.react';
import { Download, Printer } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useBookingTicketActions } from '../../hooks/useBookingTicketActions';
import { TicketShell } from './TicketShell';
import { TicketInfo, TicketPrice } from './TicketContent';
import { TicketHeading } from './TicketPrimitives';
import { BOOKING_STATUSES, bookingPaymentLabel } from './booking';
import { Button } from '../ui/button';
import type { Booking, TicketData } from './types';

export type BookingTicketProps = TicketData & {
  booking: Booking;
  pattern?: boolean;
  className?: string;
};

function BookingVisual({
  workshop,
  studio,
  session,
  artisan,
  booking,
  pattern,
}: BookingTicketProps) {
  const { label, Icon } = BOOKING_STATUSES[booking.status];
  return (
    <TicketShell
      variant="row"
      pattern={pattern}
      className="md:grid-cols-[12rem_minmax(0,1fr)]"
      body={
        <div className="flex min-w-0 flex-col gap-3 p-5">
          <span className="booking-state inline-flex items-center gap-2 self-start rounded-full border border-ticket-accent px-3 py-1 text-[13px] font-bold">
            <Icon size={16} aria-hidden="true" />
            {label}
          </span>
          <TicketHeading
            workshop={workshop}
            studio={studio}
            variant="booking"
          />
          <div className="grid gap-1.5 text-sm">
            <p>
              <strong>Địa chỉ:</strong>{' '}
              {studio.address ?? 'Liên hệ xưởng để xác nhận địa chỉ.'}
            </p>
            {artisan && (
              <p>
                <strong>Nghệ nhân:</strong>{' '}
                {artisan.name.replace(/^nghệ nhân\s+/i, '')}
              </p>
            )}
          </div>
          <TicketInfo session={session} partySize={booking.partySize} />
          <p className="text-sm font-semibold">
            {bookingPaymentLabel(booking)}
          </p>
          <TicketPrice price={workshop.price} />
        </div>
      }
      stub={
        <div className="booking-qr-stub flex h-full flex-col items-center justify-center gap-3 text-center">
          <QRCodeSVG
            value={booking.code}
            size={144}
            marginSize={4}
            level="M"
            title={`Mã QR đặt chỗ ${booking.code}`}
            className="size-36 min-w-36 shrink-0"
          />
          <p className="break-words text-sm font-bold">{booking.code}</p>
          <p className="text-xs">Mã đặt chỗ · Open Slot</p>
        </div>
      }
    />
  );
}

function CancelledStrike() {
  return (
    <span
      className="booking-cancelled-strike pointer-events-none absolute left-[12%] right-[8%] top-[52%] z-30 -rotate-[14deg] border-t-2 border-ticket-accent opacity-[.18]"
      aria-hidden="true"
    />
  );
}

export function BookingTicket(props: BookingTicketProps) {
  const { ticketRef, saving, printing, feedback, saveImage, startPrinting } =
    useBookingTicketActions(props.booking.code);
  const cancelled = props.booking.status === 'cancelled';
  const visual = (
    <>
      <BookingVisual {...props} />
      {cancelled && <CancelledStrike />}
    </>
  );
  return (
    <section
      className={cn('booking-ticket min-w-0', props.className)}
      aria-label={`Vé đặt chỗ ${props.booking.code}`}
    >
      <div
        ref={ticketRef}
        className={cn(
          'relative',
          cancelled && 'booking-cancelled opacity-[.82]',
        )}
      >
        {visual}
      </div>
      <div className="booking-actions mt-4 flex flex-wrap gap-3">
        <Button
          type="button"
          onClick={() => void saveImage()}
          disabled={saving}
          aria-busy={saving}
        >
          <Download size={18} aria-hidden="true" />
          {saving ? 'Đang lưu…' : 'Lưu vé'}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={startPrinting}
          disabled={printing}
        >
          <Printer size={18} aria-hidden="true" />
          In vé
        </Button>
      </div>
      <p className="mt-2.5 text-sm" role="status">
        {feedback}
      </p>
      {printing &&
        createPortal(
          <div className="booking-print-root hidden print:block">
            <div
              className={cn(
                'booking-ticket relative',
                cancelled && 'booking-cancelled opacity-[.82]',
              )}
            >
              {visual}
            </div>
          </div>,
          document.body,
        )}
    </section>
  );
}
