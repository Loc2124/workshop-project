import { createHash, randomBytes } from 'node:crypto';
import { query, withTransaction } from '../../db/pool.js';
import type { WebhookVerification } from './providers/payment-provider.js';
import { releaseExpiredHolds } from '../bookings/bookings.repository.js';
import { getSiteSettings } from '../settings/settings.repository.js';
import { signMockWebhook } from './providers/mock.provider.js';

type ReservationRow = {
  id: string;
  userId: string;
  sessionId: string;
  quantity: number;
  totalAmount: number;
  depositAmount: number;
  paidAmount: number;
  bookingStatus: string;
  reservationStatus: string;
  paymentMode: string;
  holdExpired: boolean;
  paymentId: string;
  paymentAmount: number;
  paymentStatus: string;
};

export async function processPaymentWebhook(
  provider: 'payos' | 'mock',
  verification: WebhookVerification,
  payload: unknown,
): Promise<'invalid_signature' | 'duplicate' | 'processed'> {
  return withTransaction(async (client) => {
    const stored = await client.query<{ id: string }>(
      `INSERT INTO webhook_events
         (provider, dedupe_key, order_code, payload, signature_valid, outcome)
       VALUES ($1, $2, $3, $4::jsonb, $5, 'received')
       ON CONFLICT (provider, dedupe_key) DO NOTHING
       RETURNING id`,
      [
        provider,
        verification.signatureValid
          ? verification.dedupeKey
          : `invalid:${createHash('sha256').update(JSON.stringify(payload)).digest('hex')}`,
        verification.orderCode,
        JSON.stringify(payload),
        verification.signatureValid,
      ],
    );
    const eventId = stored.rows[0]?.id;
    if (!eventId) return 'duplicate';
    if (!verification.signatureValid) {
      await finishWebhook(client, eventId, 'rejected');
      return 'invalid_signature';
    }

    if (verification.orderCode === null || verification.amount === null) {
      await finishWebhook(client, eventId, 'rejected');
      return 'processed';
    }

    const lookup = await client.query<{ sessionId: string }>(
      `SELECT b.session_id AS "sessionId"
       FROM payments p
       JOIN bookings b ON b.id = p.booking_id
       WHERE p.provider = $1
         AND p.order_code = $2
         AND p.kind = 'deposit'`,
      [provider, verification.orderCode],
    );
    const sessionId = lookup.rows[0]?.sessionId;
    if (!sessionId) {
      await finishWebhook(client, eventId, 'rejected');
      return 'processed';
    }

    await client.query('SELECT id FROM sessions WHERE id = $1 FOR UPDATE', [
      sessionId,
    ]);
    await releaseExpiredHolds(client, [sessionId]);
    const selected = await client.query<ReservationRow>(
      `SELECT b.id, b.user_id AS "userId", b.session_id AS "sessionId",
         b.quantity, b.total_amount AS "totalAmount",
         b.deposit_amount AS "depositAmount", b.paid_amount AS "paidAmount",
         b.status AS "bookingStatus",
         b.reservation_status AS "reservationStatus",
         b.payment_mode AS "paymentMode",
         b.hold_expires_at <= now() AS "holdExpired",
         p.id AS "paymentId", p.amount AS "paymentAmount", p.status AS "paymentStatus"
       FROM bookings b
       JOIN payments p ON p.booking_id = b.id
       WHERE p.provider = $1
         AND p.order_code = $2
         AND p.kind = 'deposit'
       FOR UPDATE OF b, p`,
      [provider, verification.orderCode],
    );
    const booking = selected.rows[0];
    if (!booking || booking.sessionId !== sessionId) {
      await finishWebhook(client, eventId, 'rejected');
      return 'processed';
    }
    if (
      verification.amount !== booking.paymentAmount ||
      booking.paymentAmount !== booking.depositAmount
    ) {
      await finishWebhook(client, eventId, 'amount_mismatch');
      return 'processed';
    }
    if (booking.paymentStatus === 'paid') {
      await finishWebhook(client, eventId, 'duplicate');
      return 'processed';
    }

    if (!verification.success) {
      await failPayment(client, eventId, booking, verification.providerRef);
      return 'processed';
    }

    const payment = await client.query(
      `UPDATE payments
       SET status = 'paid', provider_ref = $2, paid_at = now()
       WHERE id = $1 AND status <> 'paid'
       RETURNING id`,
      [booking.paymentId, verification.providerRef],
    );
    if (!payment.rowCount) {
      await finishWebhook(client, eventId, 'duplicate');
      return 'processed';
    }

    const session = await client.query<{
      status: string;
      startsAt: Date;
    }>(
      `SELECT status, starts_at AS "startsAt"
       FROM sessions
       WHERE id = $1`,
      [sessionId],
    );
    const slot = session.rows[0];
    const isLate = booking.bookingStatus === 'expired';
    let reacquired = false;
    if (isLate) {
      const reservation = await client.query(
        `UPDATE sessions
         SET seats_held = seats_held + $2
         WHERE id = $1
           AND status = 'scheduled'
           AND starts_at > now()
           AND seats_held + seats_sold + $2 <= capacity
         RETURNING id`,
        [sessionId, booking.quantity],
      );
      reacquired = Boolean(reservation.rowCount);
    }
    const canConfirm =
      slot?.status === 'scheduled' &&
      slot.startsAt > new Date() &&
      (booking.reservationStatus === 'pending' || (isLate && reacquired));

    if (!canConfirm) {
      await client.query(
        `UPDATE bookings
         SET status = 'refund_needed',
             paid_amount = LEAST(total_amount, paid_amount + $2)
         WHERE id = $1`,
        [booking.id, verification.amount],
      );
      if (reacquired) {
        await client.query(
          `UPDATE sessions
           SET seats_held = seats_held - $2
           WHERE id = $1 AND seats_held >= $2`,
          [sessionId, booking.quantity],
        );
      }
      await notifyCustomer(
        client,
        booking.userId,
        booking.id,
        'late_payment_refund_needed',
        'Khoản thanh toán cần được xử lý',
        'Đơn đã hết hiệu lực hoặc buổi không còn chỗ. Khoản cọc cần được studio xử lý hoàn thủ công.',
      );
      await finishWebhook(
        client,
        eventId,
        isLate ? 'late_payment_no_seat' : 'refund_needed',
      );
      return 'processed';
    }

    const newPaidAmount = Math.min(
      booking.totalAmount,
      booking.paidAmount + verification.amount,
    );
    const nextStatus =
      newPaidAmount >= booking.totalAmount ? 'paid' : 'pending';
    await client.query(
      `UPDATE bookings
       SET status = $2::booking_status,
           reservation_status = 'confirmed',
           paid_amount = $3,
           paid_at = CASE WHEN $2 = 'paid' THEN now() ELSE paid_at END
       WHERE id = $1`,
      [booking.id, nextStatus, newPaidAmount],
    );

    const held = await client.query(
      `UPDATE sessions
       SET seats_held = seats_held - $2,
           seats_sold = seats_sold + $2
       WHERE id = $1 AND seats_held >= $2
       RETURNING id`,
      [sessionId, booking.quantity],
    );
    if (!held.rowCount) {
      throw new Error('Booking hold exceeds the session seats currently held.');
    }
    await issueTickets(client, booking.id, booking.quantity);
    await notifyCustomer(
      client,
      booking.userId,
      booking.id,
      'deposit_paid',
      'Đã xác nhận tiền cọc',
      `Đã nhận ${verification.amount} VND. Số tiền còn lại tại studio: ${booking.totalAmount - newPaidAmount} VND.`,
    );
    await finishWebhook(
      client,
      eventId,
      isLate ? 'late_payment_confirmed' : 'processed',
    );
    return 'processed';
  });
}

export async function confirmInStudioPayment(
  studioId: string,
  userId: string,
  bookingId: string,
  expectedAmount: number,
): Promise<'not_found' | 'conflict' | 'confirmed'> {
  return withTransaction(async (client) => {
    const lookup = await client.query<{ sessionId: string }>(
      `SELECT b.session_id AS "sessionId"
       FROM bookings b
       JOIN sessions s ON s.id = b.session_id
       JOIN workshops w ON w.id = s.workshop_id
       JOIN studio_members sm ON sm.studio_id = w.studio_id
       WHERE b.id = $1 AND w.studio_id = $2 AND sm.user_id = $3`,
      [bookingId, studioId, userId],
    );
    const sessionId = lookup.rows[0]?.sessionId;
    if (!sessionId) return 'not_found';

    await client.query('SELECT id FROM sessions WHERE id = $1 FOR UPDATE', [
      sessionId,
    ]);
    const booking = await client.query<{
      totalAmount: number;
      paidAmount: number;
      reservationStatus: string;
      status: string;
    }>(
      `SELECT b.total_amount AS "totalAmount",
         b.paid_amount AS "paidAmount",
         b.reservation_status AS "reservationStatus",
         b.status
       FROM bookings b
       JOIN sessions s ON s.id = b.session_id
       JOIN workshops w ON w.id = s.workshop_id
       JOIN studio_members sm ON sm.studio_id = w.studio_id
       WHERE b.id = $1 AND w.studio_id = $2 AND sm.user_id = $3
       FOR UPDATE OF b`,
      [bookingId, studioId, userId],
    );
    const row = booking.rows[0];
    if (!row) return 'not_found';
    if (
      row.reservationStatus !== 'confirmed' ||
      ['cancelled', 'expired', 'refund_needed'].includes(row.status) ||
      row.paidAmount >= row.totalAmount
    ) {
      return 'conflict';
    }

    const payment = await client.query<{ id: string; amount: number }>(
      `SELECT id, amount
       FROM payments
       WHERE booking_id = $1
         AND provider = 'in_studio'
         AND status = 'created'
       ORDER BY created_at
       LIMIT 1
       FOR UPDATE`,
      [bookingId],
    );
    const due = payment.rows[0];
    if (
      !due ||
      due.amount !== expectedAmount ||
      due.amount + row.paidAmount !== row.totalAmount
    ) {
      return 'conflict';
    }
    await client.query(
      `UPDATE payments SET status = 'paid', paid_at = now() WHERE id = $1`,
      [due.id],
    );
    await client.query(
      `UPDATE bookings
       SET paid_amount = total_amount,
           status = 'paid',
           paid_at = now()
       WHERE id = $1`,
      [bookingId],
    );
    await notifyCustomer(
      client,
      (
        await client.query<{ userId: string }>(
          'SELECT user_id AS "userId" FROM bookings WHERE id = $1',
          [bookingId],
        )
      ).rows[0].userId,
      bookingId,
      'in_studio_payment_paid',
      'Đã ghi nhận thanh toán tại studio',
      'Studio đã xác nhận khoản thanh toán còn lại của bạn.',
    );
    return 'confirmed';
  });
}

export async function cancelCustomerBooking(
  bookingId: string,
  userId: string,
): Promise<'not_found' | 'conflict' | 'cancelled'> {
  return withTransaction(async (client) => {
    const lookup = await client.query<{ sessionId: string }>(
      'SELECT session_id AS "sessionId" FROM bookings WHERE id = $1 AND user_id = $2',
      [bookingId, userId],
    );
    const sessionId = lookup.rows[0]?.sessionId;
    if (!sessionId) return 'not_found';

    await client.query('SELECT id FROM sessions WHERE id = $1 FOR UPDATE', [
      sessionId,
    ]);
    const booking = await client.query<{
      quantity: number;
      paidAmount: number;
      status: string;
      reservationStatus: string;
      startsAt: Date;
    }>(
      `SELECT b.quantity, b.paid_amount AS "paidAmount", b.status,
         b.reservation_status AS "reservationStatus",
         s.starts_at AS "startsAt"
       FROM bookings b
       JOIN sessions s ON s.id = b.session_id
       WHERE b.id = $1 AND b.user_id = $2
       FOR UPDATE OF b`,
      [bookingId, userId],
    );
    const row = booking.rows[0];
    if (!row) return 'not_found';
    if (
      !['pending', 'confirmed'].includes(row.reservationStatus) ||
      ['cancelled', 'expired', 'refund_needed'].includes(row.status)
    ) {
      return 'conflict';
    }
    const cancellationHours = (await getSiteSettings(client)).booking
      .cancellationHours;
    const allowed = await client.query<{ allowed: boolean }>(
      `SELECT $1::timestamptz >
         clock_timestamp() + make_interval(hours => $2) AS allowed`,
      [row.startsAt, cancellationHours],
    );
    if (!allowed.rows[0]?.allowed) return 'conflict';

    const seatColumn =
      row.reservationStatus === 'pending' ? 'seats_held' : 'seats_sold';
    await client.query(
      `UPDATE bookings
       SET status = $2::booking_status,
           reservation_status = 'cancelled'
       WHERE id = $1`,
      [bookingId, row.paidAmount > 0 ? 'refund_needed' : 'cancelled'],
    );
    const released = await client.query(
      `UPDATE sessions
       SET ${seatColumn} = ${seatColumn} - $2
       WHERE id = $1 AND ${seatColumn} >= $2
       RETURNING id`,
      [sessionId, row.quantity],
    );
    if (!released.rowCount) {
      throw new Error(
        'Booking quantity exceeds the session seats currently allocated.',
      );
    }
    await client.query(
      `UPDATE payments
       SET status = 'cancelled'
       WHERE booking_id = $1 AND status = 'created'`,
      [bookingId],
    );
    await client.query(
      `UPDATE tickets SET status = 'void'
       WHERE booking_id = $1 AND status = 'valid'`,
      [bookingId],
    );
    await notifyCustomer(
      client,
      userId,
      bookingId,
      row.paidAmount > 0 ? 'booking_refund_needed' : 'booking_cancelled',
      row.paidAmount > 0 ? 'Đã hủy, cần xử lý hoàn tiền' : 'Đã hủy đặt chỗ',
      row.paidAmount > 0
        ? 'Khoản đã thanh toán cần được studio xử lý hoàn thủ công.'
        : 'Chỗ đã được trả lại cho buổi workshop.',
    );
    return 'cancelled';
  });
}

async function failPayment(
  client: import('pg').PoolClient,
  eventId: string,
  booking: ReservationRow,
  providerRef: string | null,
): Promise<void> {
  await client.query(
    `UPDATE payments
     SET status = 'failed', provider_ref = $2
     WHERE id = $1 AND status = 'created'`,
    [booking.paymentId, providerRef],
  );
  if (
    booking.bookingStatus === 'pending' &&
    booking.reservationStatus === 'pending'
  ) {
    const released = await client.query(
      `UPDATE sessions
       SET seats_held = seats_held - $2
       WHERE id = $1 AND seats_held >= $2
       RETURNING id`,
      [booking.sessionId, booking.quantity],
    );
    if (!released.rowCount) {
      throw new Error('Booking hold exceeds the session seats currently held.');
    }
    await client.query(
      `UPDATE bookings
       SET status = 'cancelled', reservation_status = 'cancelled'
       WHERE id = $1`,
      [booking.id],
    );
    await notifyCustomer(
      client,
      booking.userId,
      booking.id,
      'deposit_payment_failed',
      'Thanh toán tiền cọc thất bại',
      'Đơn đã được hủy và số chỗ giữ đã được trả lại.',
    );
  }
  await finishWebhook(client, eventId, 'payment_failed');
}

async function finishWebhook(
  client: import('pg').PoolClient,
  eventId: string,
  outcome: string,
): Promise<void> {
  await client.query(
    `UPDATE webhook_events
     SET outcome = $2, processed_at = now()
     WHERE id = $1`,
    [eventId, outcome],
  );
}

async function notifyCustomer(
  client: import('pg').PoolClient,
  userId: string,
  bookingId: string,
  type: string,
  title: string,
  body: string,
): Promise<void> {
  await client.query(
    `INSERT INTO user_notifications (user_id, booking_id, type, title, body, href)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [userId, bookingId, type, title, body, `/me/bookings/${bookingId}`],
  );
}

async function issueTickets(
  client: import('pg').PoolClient,
  bookingId: string,
  quantity: number,
): Promise<void> {
  for (let seq = 1; seq <= quantity; seq++) {
    await client.query(
      `INSERT INTO tickets (booking_id, seq, code)
       VALUES ($1, $2, $3)
       ON CONFLICT (booking_id, seq) DO NOTHING`,
      [bookingId, seq, randomBytes(18).toString('base64url')],
    );
  }
}

export async function createMockWebhook(
  userId: string,
  orderCode: number,
  checksumKey: string,
): Promise<string | null> {
  const payment = await query<{ amount: number }>(
    `SELECT p.amount
     FROM payments p
     JOIN bookings b ON b.id = p.booking_id
     WHERE p.order_code = $1
       AND p.provider = 'mock'
       AND p.kind = 'deposit'
       AND b.user_id = $2`,
    [orderCode, userId],
  );
  if (!payment.rowCount) return null;
  return JSON.stringify({
    code: '00',
    desc: 'success',
    success: true,
    data: {
      orderCode,
      amount: payment.rows[0].amount,
      reference: `mock-${orderCode}`,
      code: '00',
      desc: 'Thanh toán thành công',
    },
    signature: signMockWebhook(
      {
        orderCode,
        amount: payment.rows[0].amount,
        reference: `mock-${orderCode}`,
        code: '00',
        desc: 'Thanh toán thành công',
      },
      checksumKey,
    ),
  });
}
