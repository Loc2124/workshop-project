import type { PoolClient } from 'pg';
import {
  BOOKING_HOLD_MINUTES,
  calculateDeposit,
  bookingPaymentChoice,
  requiresAttendanceConfirmation,
} from '@workshop/shared';
import { AppError } from '../../errors/app-error.js';
import { createHash, randomBytes } from 'node:crypto';
import { query, withTransaction } from '../../db/pool.js';
import { expireScheduleResponses } from './schedule-changes.js';
import { releaseUnconfirmedBookings } from './attendance-confirmation.js';

export type CreateCustomerBookingInput = {
  requestId?: string;
  sessionId: string;
  quantity: number;
  paymentChoice?: 'deposit' | 'in_studio';
  contactName: string;
  contactPhone: string | null;
};

export type CustomerBookingCreated = {
  id: string;
  orderCode: number;
  paymentMode: 'payos_deposit' | 'in_studio' | 'free';
  totalAmount: number;
  depositAmount: number;
  balanceAmount: number;
  holdExpiresAt: string;
  checkoutRequired: boolean;
};

export async function releaseExpiredHolds(
  client: PoolClient,
  sessionIds: readonly string[],
): Promise<void> {
  const ids = [...new Set(sessionIds)];
  if (ids.length === 0) return;

  const lockedSessions = await client.query<{ id: string }>(
    `SELECT id
     FROM sessions
     WHERE id = ANY($1::uuid[])
     ORDER BY id
     FOR UPDATE`,
    [ids],
  );
  const lockedIds = lockedSessions.rows.map(({ id }) => id);
  if (lockedIds.length === 0) return;
  await expireScheduleResponses(client, lockedIds);
  await releaseUnconfirmedBookings(client, lockedIds);

  const result = await client.query<{
    expected: number;
    released: number;
  }>(
    `WITH expired AS (
       UPDATE bookings
       SET status = 'expired'
       WHERE status = 'pending'
         AND reservation_status = 'pending'
         AND hold_expires_at <= now()
         AND session_id = ANY($1::uuid[])
       RETURNING session_id, quantity
     ),
     quantities AS (
       SELECT session_id, sum(quantity)::integer AS quantity
       FROM expired
       GROUP BY session_id
     ),
     released_sessions AS (
       UPDATE sessions s
       SET seats_held = s.seats_held - quantities.quantity
       FROM quantities
       WHERE s.id = quantities.session_id
         AND s.seats_held >= quantities.quantity
       RETURNING s.id
     )
     SELECT
       (SELECT count(*)::integer FROM quantities) AS expected,
       (SELECT count(*)::integer FROM released_sessions) AS released`,
    [lockedIds],
  );

  if (result.rows[0]?.expected !== result.rows[0]?.released) {
    throw new Error(
      'Expired booking quantities exceed the session seats currently held.',
    );
  }
}

export async function createCustomerBooking(
  userId: string,
  input: CreateCustomerBookingInput,
  _holdMinutes: number,
  paymentProvider: 'payos' | 'mock',
): Promise<
  | { kind: 'not_found' }
  | { kind: 'unavailable' }
  | { kind: 'invalid_amount' }
  | { kind: 'created'; booking: CustomerBookingCreated }
  | {
      kind: 'replayed';
      booking: CustomerBookingCreated;
      checkoutUrl: string | null;
      checkoutQrCode: string | null;
    }
> {
  return withTransaction(async (client) => {
    if (input.requestId) {
      const hash = createHash('sha256')
        .update(
          JSON.stringify([
            input.sessionId,
            input.quantity,
            input.paymentChoice ?? null,
          ]),
        )
        .digest('hex');
      await client.query(
        `INSERT INTO booking_requests(user_id,request_id,payload_hash) VALUES($1,$2,$3) ON CONFLICT DO NOTHING`,
        [userId, input.requestId, hash],
      );
      const request = (
        await client.query<{ payloadHash: string; bookingId: string | null }>(
          `SELECT payload_hash AS "payloadHash",booking_id AS "bookingId" FROM booking_requests WHERE user_id=$1 AND request_id=$2 FOR UPDATE`,
          [userId, input.requestId],
        )
      ).rows[0];
      if (request.payloadHash !== hash)
        throw new AppError(
          409,
          'IDEMPOTENCY_KEY_REUSED',
          'Yêu cầu trước có thông tin khác. Vui lòng kiểm tra lại đặt chỗ đã tạo.',
        );
      if (request.bookingId) {
        const stored = (
          await client.query<
            CustomerBookingCreated & {
              checkoutUrl: string | null;
              checkoutQrCode: string | null;
            }
          >(
            `SELECT b.id,b.order_code::integer AS "orderCode",b.payment_mode AS "paymentMode",b.total_amount AS "totalAmount",b.deposit_amount AS "depositAmount",b.total_amount-b.deposit_amount AS "balanceAmount",b.hold_expires_at AS "holdExpiresAt",
           (b.reservation_status='pending' AND b.status='pending' AND b.hold_expires_at>now() AND s.starts_at>now() AND s.status='scheduled') AS "checkoutRequired",
           CASE WHEN b.reservation_status='pending' AND b.status='pending' AND b.hold_expires_at>now() AND s.starts_at>now() AND s.status='scheduled' THEN p.checkout_url END AS "checkoutUrl",
           CASE WHEN b.reservation_status='pending' AND b.status='pending' AND b.hold_expires_at>now() AND s.starts_at>now() AND s.status='scheduled' THEN p.qr_code END AS "checkoutQrCode"
           FROM bookings b JOIN sessions s ON s.id=b.session_id LEFT JOIN payments p ON p.booking_id=b.id AND p.kind='deposit' AND p.checkout_revision=b.checkout_revision AND p.status='created'
           WHERE b.id=$1 AND b.user_id=$2`,
            [request.bookingId, userId],
          )
        ).rows[0];
        const { checkoutUrl, checkoutQrCode, ...booking } = stored;
        return {
          kind: 'replayed' as const,
          booking,
          checkoutUrl,
          checkoutQrCode,
        };
      }
    }
    const target = await client.query<{ studioId: string }>(
      `SELECT w.studio_id AS "studioId"
       FROM sessions s
       JOIN workshops w ON w.id = s.workshop_id
       WHERE s.id = $1`,
      [input.sessionId],
    );
    const studioId = target.rows[0]?.studioId;
    if (!studioId) return { kind: 'not_found' as const };

    await client.query('SELECT id FROM studios WHERE id = $1 FOR SHARE', [
      studioId,
    ]);
    await releaseExpiredHolds(client, [input.sessionId]);

    const details = await client.query<{
      price: number;
      startsAt: Date;
      createdAt: Date;
      workshopTitle: string;
      effectiveDepositPercent: number;
      depositMode: 'none' | 'optional' | 'required';
      releaseIfUnconfirmed: boolean;
      releaseBeforeMinutes: number;
    }>(
      `SELECT s.price, now() AS "createdAt",
         s.starts_at AS "startsAt",
         w.title AS "workshopTitle",
         effective_deposit_percent(st,w) AS "effectiveDepositPercent",
         effective_deposit_mode(st,w) AS "depositMode",
         st.release_if_unconfirmed AS "releaseIfUnconfirmed",st.release_before_minutes AS "releaseBeforeMinutes"
       FROM sessions s
       JOIN workshops w ON w.id = s.workshop_id
       JOIN studios st ON st.id = w.studio_id
       WHERE s.id = $1
         AND s.status = 'scheduled'
         AND s.starts_at > now()
         AND COALESCE(s.registration_deadline, s.starts_at) > now()
         AND w.status = 'approved'
         AND NOT w.is_simulated
         AND NOT w.is_discontinued
         AND w.visibility_status = 'active'
         AND w.publication_status = 'published'
         AND st.status = 'approved'
         AND NOT st.is_hidden
         AND NOT st.is_draft
         AND studio_profile_complete(st)
       FOR SHARE OF w`,
      [input.sessionId],
    );
    const session = details.rows[0];
    if (!session) return { kind: 'not_found' as const };

    const totalAmount = session.price * input.quantity;
    if (!Number.isSafeInteger(totalAmount) || totalAmount > 2_147_483_647) {
      return { kind: 'invalid_amount' as const };
    }

    let choice: 'deposit' | 'in_studio';
    try {
      choice = bookingPaymentChoice(session.depositMode, input.paymentChoice);
    } catch (error) {
      throw new AppError(
        422,
        'UNPROCESSABLE_ENTITY',
        error instanceof Error
          ? error.message
          : 'Vui lòng chọn cách thanh toán.',
      );
    }
    const paymentMode =
      totalAmount === 0
        ? 'free'
        : choice === 'deposit' && session.effectiveDepositPercent > 0
          ? 'payos_deposit'
          : 'in_studio';
    const depositAmount =
      paymentMode === 'payos_deposit'
        ? calculateDeposit(totalAmount, session.effectiveDepositPercent)
        : 0;
    const minimum = Number(process.env.PAYMENT_MIN_AMOUNT ?? 0);
    if (
      paymentMode === 'payos_deposit' &&
      minimum > 0 &&
      depositAmount < minimum
    )
      throw new AppError(
        422,
        'UNPROCESSABLE_ENTITY',
        'Mức cọc của buổi học này cần được studio điều chỉnh. Vui lòng liên hệ studio hoặc chọn buổi khác.',
      );
    const balanceAmount = totalAmount - depositAmount;

    const reserved =
      paymentMode === 'payos_deposit'
        ? await client.query<{ price: number }>(
            `UPDATE sessions
             SET seats_held = seats_held + $1
             WHERE id = $2
               AND status = 'scheduled'
               AND starts_at > now()
               AND COALESCE(registration_deadline, starts_at) > now()
               AND seats_held + seats_sold + $1 <= capacity
             RETURNING price`,
            [input.quantity, input.sessionId],
          )
        : await client.query<{ price: number }>(
            `UPDATE sessions
             SET seats_sold = seats_sold + $1
             WHERE id = $2
               AND status = 'scheduled'
               AND starts_at > now()
               AND COALESCE(registration_deadline, starts_at) > now()
               AND seats_held + seats_sold + $1 <= capacity
             RETURNING price`,
            [input.quantity, input.sessionId],
          );
    if (!reserved.rowCount) return { kind: 'unavailable' as const };

    const orderCode = await nextOrderCode(client);
    const inserted = await client.query<{
      id: string;
      holdExpiresAt: string;
    }>(
      `INSERT INTO bookings (
         user_id, session_id, quantity, unit_price, total_amount, status,
         hold_expires_at, order_code, reservation_status, contact_name,
         contact_phone, deposit_amount, paid_amount, payment_mode, deposit_percent,deposit_mode,release_if_unconfirmed,release_before_minutes
       )
       VALUES (
         $1, $2, $3, $4, $5, $6::booking_status,
         CASE WHEN $7::boolean
           THEN now() + make_interval(mins => $8)
           ELSE $9
         END,
         $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20
       )
       RETURNING id, hold_expires_at AS "holdExpiresAt"`,
      [
        userId,
        input.sessionId,
        input.quantity,
        session.price,
        totalAmount,
        paymentMode === 'free' ? 'paid' : 'pending',
        paymentMode === 'payos_deposit',
        BOOKING_HOLD_MINUTES,
        session.startsAt,
        orderCode,
        paymentMode === 'payos_deposit' ? 'pending' : 'confirmed',
        input.contactName,
        input.contactPhone,
        depositAmount,
        paymentMode === 'free' ? totalAmount : 0,
        paymentMode,
        session.depositMode !== 'none' ? session.effectiveDepositPercent : null,
        session.depositMode,
        requiresAttendanceConfirmation({
          enabled: session.releaseIfUnconfirmed,
          paymentMode,
          startsAt: session.startsAt,
          createdAt: session.createdAt,
          releaseBeforeMinutes: session.releaseBeforeMinutes,
        }),
        session.releaseBeforeMinutes,
      ],
    );
    const booking = inserted.rows[0];
    if (input.requestId)
      await client.query(
        'UPDATE booking_requests SET booking_id=$3 WHERE user_id=$1 AND request_id=$2',
        [userId, input.requestId, booking.id],
      );

    if (paymentMode === 'payos_deposit') {
      await client.query(
        `INSERT INTO payments
           (booking_id, provider, order_code, amount, status, kind)
         VALUES ($1, $2, $3, $4, 'created', 'deposit')`,
        [booking.id, paymentProvider, orderCode, depositAmount],
      );
      if (balanceAmount > 0) {
        await client.query(
          `INSERT INTO payments
             (booking_id, provider, order_code, amount, status, kind)
           VALUES ($1, 'in_studio', $2, $3, 'created', 'balance')`,
          [booking.id, orderCode, balanceAmount],
        );
      }
    } else if (paymentMode === 'in_studio') {
      await client.query(
        `INSERT INTO payments
           (booking_id, provider, order_code, amount, status, kind)
         VALUES ($1, 'in_studio', $2, $3, 'created', 'in_studio')`,
        [booking.id, orderCode, totalAmount],
      );
    }

    if (paymentMode !== 'payos_deposit') {
      await issueTickets(client, booking.id);
    }

    await client.query(
      `INSERT INTO user_notifications (user_id, booking_id, type, title, body, href)
       VALUES ($1, $2, 'booking_created', $3, $4, $5)`,
      [
        userId,
        booking.id,
        paymentMode === 'payos_deposit'
          ? 'Chờ thanh toán tiền cọc'
          : 'Đã nhận đặt chỗ',
        paymentMode === 'payos_deposit'
          ? `Vui lòng thanh toán ${depositAmount} VND tiền cọc để xác nhận chỗ.`
          : paymentMode === 'free'
            ? 'Đặt chỗ miễn phí đã được xác nhận. Vé tham gia đã sẵn sàng.'
            : 'Bạn thanh toán tại studio khi tham gia workshop.',
        `/me/bookings/${booking.id}`,
      ],
    );

    return {
      kind: 'created' as const,
      booking: {
        id: booking.id,
        orderCode,
        paymentMode,
        totalAmount,
        depositAmount,
        balanceAmount,
        holdExpiresAt: booking.holdExpiresAt,
        checkoutRequired: paymentMode === 'payos_deposit',
      },
    };
  });
}

export async function saveCheckoutLink(
  bookingId: string,
  provider: 'payos' | 'mock',
  checkoutUrl: string,
  providerRef: string | null,
  qrCode: string | null,
  transferDescription?: string,
): Promise<void> {
  await withTransaction(async (client) => {
    const result = await client.query(
      `UPDATE payments p
       SET checkout_url = $3,
           provider_ref = $4,
           qr_code = $5,
           transfer_description = $6
       FROM bookings b
       WHERE p.booking_id = b.id
         AND b.id = $1
         AND p.kind = 'deposit'
         AND p.provider = $2
         AND p.status = 'created'`,
      [
        bookingId,
        provider,
        checkoutUrl,
        providerRef,
        qrCode,
        transferDescription ?? null,
      ],
    );
    if (!result.rowCount) {
      throw new Error('Pending PayOS payment was not found for the booking.');
    }
  });
}

export async function failCheckout(bookingId: string): Promise<void> {
  await withTransaction(async (client) => {
    const lookup = await client.query<{ sessionId: string }>(
      'SELECT session_id AS "sessionId" FROM bookings WHERE id = $1',
      [bookingId],
    );
    const sessionId = lookup.rows[0]?.sessionId;
    if (!sessionId) return;

    await client.query('SELECT id FROM sessions WHERE id = $1 FOR UPDATE', [
      sessionId,
    ]);
    const booking = await client.query<{
      quantity: number;
      reservationStatus: string;
      status: string;
    }>(
      `SELECT quantity,
         reservation_status AS "reservationStatus",
         status
       FROM bookings
       WHERE id = $1
       FOR UPDATE`,
      [bookingId],
    );
    const row = booking.rows[0];
    if (
      !row ||
      row.status !== 'pending' ||
      row.reservationStatus !== 'pending'
    ) {
      return;
    }

    await client.query(
      `UPDATE payments
       SET status = 'failed'
       WHERE booking_id = $1 AND kind = 'deposit' AND status = 'created'`,
      [bookingId],
    );
    const released = await client.query(
      `UPDATE sessions
       SET seats_held = seats_held - $2
       WHERE id = $1 AND seats_held >= $2
       RETURNING id`,
      [sessionId, row.quantity],
    );
    if (!released.rowCount) {
      throw new Error('Booking hold exceeds the session seats currently held.');
    }
    await client.query(
      `UPDATE bookings
       SET status = 'cancelled', reservation_status = 'cancelled'
       WHERE id = $1`,
      [bookingId],
    );
  });
}

const paymentEligibleSql = `b.reservation_status='pending' AND b.status='pending' AND b.hold_expires_at>clock_timestamp() AND s.status='scheduled' AND s.starts_at>clock_timestamp() AND COALESCE(s.registration_deadline,s.starts_at)>clock_timestamp()
 AND w.status='approved' AND NOT w.is_simulated AND NOT w.is_discontinued AND w.visibility_status='active' AND w.publication_status='published' AND st.status='approved' AND NOT st.is_hidden AND NOT st.is_draft AND studio_profile_complete(st)`;
export async function getCustomerBooking(userId: string, bookingId: string) {
  return withTransaction(async (client) => {
    const lookup = await client.query<{ sessionId: string }>(
      'SELECT session_id AS "sessionId" FROM bookings WHERE id=$1 AND user_id=$2',
      [bookingId, userId],
    );
    if (!lookup.rows[0]) return null;
    await releaseExpiredHolds(client, [lookup.rows[0].sessionId]);
    const result = await client.query(
      `SELECT b.id, b.order_code::text AS "orderCode",
       b.session_id AS "sessionId", b.quantity, b.unit_price AS "unitPrice",
       b.original_quantity AS "originalQuantity",b.original_total_amount AS "originalTotalAmount",b.original_deposit_amount AS "originalDepositAmount",b.seat_revision AS "seatRevision",
       CASE WHEN b.reservation_status='cancelled' OR b.status='expired' THEN 0 ELSE (SELECT count(*)::integer FROM booking_seats bs WHERE bs.booking_id=b.id AND bs.state='active') END AS "remainingQuantity",
       ((SELECT COALESCE(sum(paid_amount),0) FROM booking_seats bs WHERE bs.booking_id=b.id)+b.extra_received_amount)::double precision AS "receivedAmount",
       (${paymentEligibleSql}) AS "paymentAllowed",
       (SELECT p0.checkout_setup FROM payments p0 WHERE p0.booking_id=b.id AND p0.kind='deposit' AND p0.checkout_revision=b.checkout_revision LIMIT 1) AS "checkoutState",
       b.total_amount AS "totalAmount", b.deposit_amount AS "depositAmount",
       b.paid_amount AS "paidAmount", b.total_amount-b.paid_amount AS "balanceAmount",
       b.status AS "paymentStatus", b.reservation_status AS "reservationStatus",
       b.payment_mode AS "paymentMode", b.hold_expires_at AS "holdExpiresAt",
       b.deposit_percent AS "depositPercent", b.deposit_mode AS "depositMode",
       b.refund_status AS "refundStatus", (b.refund_due_amount+b.extra_refund_due_amount)::double precision AS "refundDueAmount",
       (b.refunded_amount+b.extra_refunded_amount)::double precision AS "refundedAmount",EXISTS(SELECT 1 FROM tickets t WHERE t.booking_id=b.id AND t.attendance_status<>'unmarked') AS "hasAttendance",EXISTS(SELECT 1 FROM tickets t WHERE t.booking_id=b.id AND t.attendance_status='attended') AS "hasAttended",
       b.attendance_status AS "attendanceStatus",b.attendance_confirmed_at AS "attendanceConfirmedAt",
       b.release_if_unconfirmed AS "releaseIfUnconfirmed",b.release_before_minutes AS "releaseBeforeMinutes",
       attendance_confirmation_deadline(b.id) AS "attendanceConfirmationDeadline",
       b.reschedule_pending AS "reschedulePending",b.original_starts_at AS "originalStartsAt",b.original_ends_at AS "originalEndsAt",
       s.schedule_version AS "scheduleVersion",b.schedule_version AS "acceptedScheduleVersion",b.proposed_schedule_version AS "proposedScheduleVersion",
       b.booked_starts_at AS "bookedStartsAt",b.booked_ends_at AS "bookedEndsAt",b.reschedule_deadline AS "rescheduleDeadline",b.cancelled_at AS "cancelledAt",
       clock_timestamp() AS "serverNow",
       (s.status='scheduled' AND s.starts_at>clock_timestamp()
         AND COALESCE(s.registration_deadline,s.starts_at)>clock_timestamp()
         AND s.capacity-s.seats_held-s.seats_sold>=b.quantity
         AND w.status='approved' AND NOT w.is_simulated AND NOT w.is_discontinued
         AND w.visibility_status='active' AND w.publication_status='published'
         AND st.status='approved' AND NOT st.is_hidden AND NOT st.is_draft
         AND studio_profile_complete(st)) AS "canRebook",
       COALESCE(b.contact_name, u.full_name) AS "contactName", COALESCE(b.contact_phone, u.phone, '') AS "contactPhone",
       b.created_at AS "createdAt", b.paid_at AS "paidAt",
       s.starts_at AS "startsAt", s.ends_at AS "endsAt", s.status AS "sessionRecordStatus",
       w.id AS "workshopId", w.title AS "workshopTitle",
       st.name AS "studioName", st.slug AS "studioSlug",st.contact_phone AS "studioContactPhone",st.contact_email AS "studioContactEmail",st.address,
       COALESCE(json_agg(
         json_build_object(
           'provider', p.provider, 'kind', p.kind, 'amount', p.amount,
           'status', p.status, 'checkoutUrl', CASE WHEN p.checkout_revision=b.checkout_revision AND p.status='created' AND p.checkout_setup='ready' AND (${paymentEligibleSql}) THEN p.checkout_url END,
           'qrCode', CASE WHEN p.checkout_revision=b.checkout_revision AND p.status='created' AND p.checkout_setup='ready' AND (${paymentEligibleSql}) THEN p.qr_code END, 'paidAt', p.paid_at,'transferDescription',p.transfer_description,
           'orderCode',p.order_code::integer,'checkoutRevision',p.checkout_revision,'isCurrent',p.checkout_revision=b.checkout_revision
         ) ORDER BY p.created_at
       ) FILTER (WHERE p.id IS NOT NULL), '[]'::json) AS payments
     FROM bookings b
     JOIN users u ON u.id = b.user_id
     JOIN sessions s ON s.id = b.session_id
     JOIN workshops w ON w.id = s.workshop_id
     JOIN studios st ON st.id = w.studio_id
     LEFT JOIN payments p ON p.booking_id = b.id
     WHERE b.id = $1 AND b.user_id = $2
     GROUP BY b.id, u.id, s.id, w.id, st.id`,
      [bookingId, userId],
    );
    return result.rows[0] ?? null;
  });
}

export async function listCustomerBookings(userId: string) {
  const result = await query(
    `SELECT b.id, b.order_code::text AS "orderCode",
       b.quantity, b.total_amount AS "totalAmount",
       b.deposit_amount AS "depositAmount", b.paid_amount AS "paidAmount",
       b.total_amount-b.paid_amount AS "balanceAmount",
       b.status AS "paymentStatus", b.reservation_status AS "reservationStatus",
       b.payment_mode AS "paymentMode", b.created_at AS "createdAt",
       CASE WHEN b.reservation_status='cancelled' THEN b.booked_starts_at ELSE s.starts_at END AS "startsAt",
       CASE WHEN b.reservation_status='cancelled' THEN b.booked_ends_at ELSE s.ends_at END AS "endsAt", s.status AS "sessionRecordStatus", w.title AS "workshopTitle",
       st.name AS "studioName"
     FROM bookings b
     JOIN sessions s ON s.id = b.session_id
     JOIN workshops w ON w.id = s.workshop_id
     JOIN studios st ON st.id = w.studio_id
     WHERE b.user_id = $1
     ORDER BY b.created_at DESC, b.id DESC
     LIMIT 100`,
    [userId],
  );
  return result.rows;
}

export async function listStudioBookings(studioId: string, userId: string) {
  const member = await query(
    'SELECT 1 FROM studio_members WHERE studio_id=$1 AND user_id=$2',
    [studioId, userId],
  );
  if (!member.rowCount) return null;
  const result = await query(
    `SELECT b.id, b.order_code::text AS "orderCode", b.quantity,
       COALESCE(b.contact_name,u.full_name) AS "contactName",
       COALESCE(b.contact_phone,u.phone) AS "contactPhone",
       b.total_amount AS "totalAmount", b.paid_amount AS "paidAmount",
       b.deposit_amount AS "depositAmount", b.payment_mode AS "paymentMode",b.refund_status AS "refundStatus",(b.refund_due_amount+b.extra_refund_due_amount)::double precision AS "refundDueAmount",(b.refunded_amount+b.extra_refunded_amount)::double precision AS "refundedAmount",
       b.total_amount-b.paid_amount AS "balanceAmount",
       b.status AS "paymentStatus", b.reservation_status AS "reservationStatus",
       b.reschedule_pending AS "reschedulePending",b.reschedule_deadline AS "rescheduleDeadline",b.seat_revision AS "seatRevision",b.original_quantity AS "originalQuantity",
       s.starts_at AS "startsAt",s.ends_at AS "endsAt",b.attendance_status AS "attendanceStatus", w.title AS "workshopTitle"
     FROM bookings b JOIN users u ON u.id=b.user_id
     JOIN sessions s ON s.id=b.session_id JOIN workshops w ON w.id=s.workshop_id
     WHERE w.studio_id=$1 ORDER BY b.created_at DESC,b.id LIMIT 200`,
    [studioId],
  );
  return result.rows;
}

export async function getCustomerTickets(userId: string, bookingId: string) {
  const booking = await query(
    `SELECT id, reservation_status AS "reservationStatus"
     FROM bookings
     WHERE id = $1 AND user_id = $2`,
    [bookingId, userId],
  );
  if (!booking.rowCount) return null;
  const tickets = await query(
    `SELECT t.id,t.seq,t.code,t.manual_code AS "manualCode",t.status,t.issued_at AS "issuedAt",
       t.attendance_status AS "attendanceStatus",t.attendance_method AS "attendanceMethod",
       t.attendance_marked_at AS "attendanceMarkedAt",marker.full_name AS "attendanceMarkedBy",
       t.refund_due_amount AS "refundDueAmount",t.refunded_amount AS "refundedAmount"
     FROM tickets t LEFT JOIN users marker ON marker.id=t.attendance_marked_by
     WHERE t.booking_id = $1
     ORDER BY t.seq`,
    [bookingId],
  );
  return { tickets: tickets.rows };
}

async function nextOrderCode(client: PoolClient): Promise<number> {
  for (let attempt = 0; attempt < 100; attempt++) {
    const next = await client.query<{ code: number }>(
      "SELECT nextval('booking_order_code_seq')::integer AS code",
    );
    const code = next.rows[0]?.code;
    if (code === undefined || code > 999_999_999) {
      throw new Error('PayOS order-code sequence is exhausted.');
    }
    const existing = await client.query(
      'SELECT 1 FROM bookings WHERE order_code = $1',
      [code],
    );
    if (!existing.rowCount) return code;
  }
  throw new Error('Unable to allocate a unique booking order code.');
}

async function issueTickets(
  client: PoolClient,
  bookingId: string,
): Promise<void> {
  const seats = (
    await client.query<{ seq: number }>(
      "SELECT seq FROM booking_seats WHERE booking_id=$1 AND state='active' ORDER BY seq",
      [bookingId],
    )
  ).rows;
  for (const { seq } of seats) {
    await client.query(
      `INSERT INTO tickets (booking_id, seq, code)
       VALUES ($1, $2, $3)
       ON CONFLICT (booking_id, seq) DO NOTHING`,
      [bookingId, seq, randomBytes(18).toString('base64url')],
    );
  }
}
