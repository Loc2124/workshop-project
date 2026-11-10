import { query } from '../db/pool.js';
import { loadConfig } from '../config.js';
import { queueEmail } from './email.js';
import { emailTemplate } from './templates.js';

type BookingEmailRow = {
  id: string;
  email: string;
  fullName: string;
  workshopTitle: string;
  studioName: string;
  startsAt: Date;
  orderCode: string;
  depositAmount: number;
  paymentMode: string;
  checkoutUrl: string | null;
  ticketCodes: string[];
};

export function queueBookingEmail(
  bookingId: string,
  type:
    | 'booking_hold'
    | 'booking_confirmed'
    | 'payment_confirmed'
    | 'booking_cancelled'
    | 'booking_expired',
) {
  void (async () => {
    const result = await query<BookingEmailRow>(
      `SELECT b.id,u.email,u.full_name AS "fullName",w.title AS "workshopTitle",
        st.name AS "studioName",s.starts_at AS "startsAt",b.order_code::text AS "orderCode",
        b.deposit_amount AS "depositAmount",b.payment_mode AS "paymentMode",
        (SELECT p.checkout_url FROM payments p WHERE p.booking_id=b.id AND p.status='created'
          ORDER BY p.created_at DESC LIMIT 1) AS "checkoutUrl",
        ARRAY(SELECT t.manual_code FROM tickets t WHERE t.booking_id=b.id AND t.status='valid'
          ORDER BY t.seq) AS "ticketCodes"
       FROM bookings b JOIN users u ON u.id=b.user_id JOIN sessions s ON s.id=b.session_id
       JOIN workshops w ON w.id=s.workshop_id JOIN studios st ON st.id=w.studio_id
       WHERE b.id=$1`,
      [bookingId],
    );
    const booking = result.rows[0];
    if (!booking?.id) return;
    const date = new Intl.DateTimeFormat('vi-VN', {
      weekday: 'long',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
      timeZone: 'Asia/Ho_Chi_Minh',
    }).format(booking.startsAt);
    const title =
      type === 'payment_confirmed'
        ? 'Đã xác nhận thanh toán'
        : type === 'booking_cancelled'
          ? 'Đặt chỗ đã được hủy'
          : type === 'booking_expired'
            ? 'Đã hết thời gian giữ chỗ'
            : type === 'booking_hold'
              ? 'Open Slot đã nhận yêu cầu đặt chỗ'
              : 'Đặt chỗ của bạn đã được xác nhận';
    const paragraphs = [
      `Xin chào ${booking.fullName},`,
      `${booking.workshopTitle} tại ${booking.studioName} · ${date}. Mã đơn: ${booking.orderCode}.`,
    ];
    if (type === 'booking_hold' && booking.depositAmount > 0) {
      paragraphs.push(
        `Khoản cọc cần thanh toán: ${new Intl.NumberFormat('vi-VN').format(booking.depositAmount)} đ. Mở đơn đặt chỗ để xem hướng dẫn thanh toán và mã chuyển khoản${booking.checkoutUrl ? `: ${booking.checkoutUrl}` : '.'}`,
      );
    }
    if (type === 'payment_confirmed') {
      paragraphs.push(
        `Mã vé của bạn: ${booking.ticketCodes.join(', ') || 'Đã cập nhật trong tài khoản Open Slot.'}`,
      );
      paragraphs.push(
        'Hãy xuất trình mã QR trên vé khi đến studio. Mỗi khách có một mã vé riêng.',
      );
    }
    if (type === 'booking_cancelled')
      paragraphs.push(
        'Nếu khoản thanh toán cần được hoàn, trạng thái và thông tin đối soát sẽ được cập nhật trong chi tiết đơn.',
      );
    if (type === 'booking_expired')
      paragraphs.push(
        'Thời gian giữ chỗ đã kết thúc nên chỗ chưa thanh toán được giải phóng. Bạn có thể xem các lịch còn chỗ trên Open Slot.',
      );
    const clientUrl =
      loadConfig().CLIENT_URL ??
      loadConfig().WEB_ORIGIN ??
      'http://localhost:3000';
    const url = new URL(`/me/bookings/${booking.id}`, clientUrl).toString();
    const content = emailTemplate({
      title,
      paragraphs,
      cta: { label: 'Xem đơn đặt chỗ', href: url },
    });
    queueEmail({
      to: booking.email,
      subject: `${title} · ${booking.workshopTitle}`,
      ...content,
      type,
      idempotencyKey: `${type}:${booking.id}`,
    });
  })().catch((error: unknown) =>
    console.error('Booking email preparation failed.', error),
  );
}

export function queuePaidBookingEmail(orderCode: string | number) {
  void query<{ id: string }>(
    `SELECT b.id FROM bookings b JOIN payments p ON p.booking_id=b.id
     WHERE p.order_code::text=$1 AND b.reservation_status='confirmed'
       AND b.paid_amount>0 LIMIT 1`,
    [String(orderCode)],
  )
    .then((result) => {
      const bookingId = result.rows[0]?.id;
      if (bookingId) queueBookingEmail(bookingId, 'payment_confirmed');
    })
    .catch((error: unknown) =>
      console.error('Paid booking email lookup failed.', error),
    );
}

export function queueRefundEmail(
  bookingId: string,
  transferId: string,
  amount: string | number,
  reference?: string | null,
) {
  void (async () => {
    const result = await query<{
      email: string;
      fullName: string;
      workshopTitle: string;
    }>(
      `SELECT u.email,u.full_name AS "fullName",w.title AS "workshopTitle"
       FROM bookings b JOIN users u ON u.id=b.user_id JOIN sessions s ON s.id=b.session_id
       JOIN workshops w ON w.id=s.workshop_id WHERE b.id=$1`,
      [bookingId],
    );
    const customer = result.rows[0];
    if (!customer) return;
    const formattedAmount = new Intl.NumberFormat('vi-VN').format(
      Number(amount),
    );
    const content = emailTemplate({
      title: 'Khoản hoàn tiền đã được chuyển',
      paragraphs: [
        `Xin chào ${customer.fullName},`,
        `Khoản hoàn ${formattedAmount} đ cho đặt chỗ workshop ${customer.workshopTitle} đã được chuyển.${reference ? ` Mã đối chiếu: ${reference}.` : ''}`,
      ],
      cta: {
        label: 'Xem chi tiết đặt chỗ',
        href: new URL(
          `/me/bookings/${bookingId}`,
          loadConfig().CLIENT_URL,
        ).toString(),
      },
    });
    queueEmail({
      to: customer.email,
      subject: 'Open Slot đã chuyển khoản hoàn tiền',
      ...content,
      type: 'refund_sent',
      idempotencyKey: `refund-sent:${transferId}`,
    });
  })().catch((error: unknown) =>
    console.error('Refund email preparation failed.', error),
  );
}
