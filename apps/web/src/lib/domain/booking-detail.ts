import type { CustomerBooking } from '@/services/customerBookingService';

export function bookingDetailState(booking: CustomerBooking, now: number) {
  const deposit =
    booking.payments.find(
      (payment) =>
        payment.kind === 'deposit' &&
        payment.isCurrent !== false &&
        payment.status === 'created',
    ) ??
    booking.payments.find(
      (payment) => payment.kind === 'deposit' && payment.isCurrent !== false,
    );
  const confirmed = ['confirmed', 'completed'].includes(
    booking.reservationStatus,
  );
  const cancelled = booking.reservationStatus === 'cancelled';
  const expired = booking.paymentStatus === 'expired';
  const deadlinePassed = now >= Date.parse(booking.holdExpiresAt);
  const upcoming =
    booking.sessionRecordStatus !== 'cancelled' &&
    now < Date.parse(booking.startsAt);
  const depositPaid =
    booking.payments.some(
      (payment) => payment.kind === 'deposit' && payment.status === 'paid',
    ) &&
    booking.paidAmount >= booking.depositAmount &&
    booking.depositAmount > 0;
  return {
    deposit,
    confirmed,
    cancelled,
    expired,
    deadlinePassed,
    upcoming,
    depositPaid,
    canPay:
      booking.paymentAllowed !== false &&
      booking.paymentMode === 'payos_deposit' &&
      booking.reservationStatus === 'pending' &&
      booking.paymentStatus === 'pending' &&
      !deadlinePassed &&
      upcoming &&
      !depositPaid,
    canCancel:
      !booking.hasAttended &&
      !(booking.hasAttendance && booking.paidAmount > 0) &&
      ['pending', 'confirmed'].includes(booking.reservationStatus) &&
      !['cancelled', 'expired', 'refund_needed'].includes(
        booking.paymentStatus,
      ) &&
      (confirmed || !deadlinePassed),
    projectedStudioAmount: Math.max(
      0,
      booking.totalAmount - booking.depositAmount,
    ),
    actualBalance: Math.max(0, booking.totalAmount - booking.paidAmount),
    remainingSeconds: Math.max(
      0,
      Math.ceil((Date.parse(booking.holdExpiresAt) - now) / 1000),
    ),
  };
}

export function bookingScheduleLabel(startsAt: string, endsAt: string) {
  const options = { timeZone: 'Asia/Ho_Chi_Minh' };
  const time = (value: string) =>
    new Intl.DateTimeFormat('vi-VN', {
      ...options,
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).format(new Date(value));
  const date = (value: string) =>
    new Intl.DateTimeFormat('vi-VN', {
      ...options,
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(new Date(value));
  return date(startsAt) === date(endsAt)
    ? `${time(startsAt)}–${time(endsAt)} · ${date(startsAt)}`
    : `${time(startsAt)} · ${date(startsAt)} – ${time(endsAt)} · ${date(endsAt)}`;
}
