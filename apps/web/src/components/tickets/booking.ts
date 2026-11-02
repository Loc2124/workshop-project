import { BadgeCheck, Clock, CircleCheck, Ban } from 'lucide-react';
import type { Booking } from './types';

export const BOOKING_STATUSES = {
  pending: { label: 'Chờ xác nhận', Icon: Clock },
  confirmed: { label: 'Đã xác nhận', Icon: BadgeCheck },
  completed: { label: 'Đã hoàn thành', Icon: CircleCheck },
  cancelled: { label: 'Đã hủy', Icon: Ban },
};

export function bookingPaymentLabel(booking: Booking) {
  if (booking.paymentStatus === 'refunded') return 'Đã hoàn tiền';
  if (booking.paymentStatus === 'paid')
    return booking.paymentMethod === 'prepaid'
      ? 'Đã thanh toán trước'
      : 'Đã thanh toán tại studio';
  return booking.paymentMethod === 'at_studio'
    ? 'Trả tại studio'
    : 'Chờ thanh toán trước';
}
