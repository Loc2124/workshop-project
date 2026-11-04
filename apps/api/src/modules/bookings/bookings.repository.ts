import type { PoolClient } from 'pg';
import { randomBytes } from 'node:crypto';
import { query, withTransaction } from '../../db/pool.js';
import { studioDepositEligibleSql } from '../studios/studio-profile-sql.js';

export type CreateCustomerBookingInput = {
  sessionId: string;
  quantity: number;
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

  const result = await client.query<{
    expected: number;
    released: number;
  }>(
    `WITH expired AS (
       UPDATE bookings
       SET status = 'expired'
       WHERE status = 'pending'
         AND reservation_status = 'pending'
         AND hold_expires_at < now()
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
  holdMinutes: number,
  paymentProvider: 'payos' | 'mock',
): Promise<
  | { kind: 'not_found' }
  | { kind: 'unavailable' }
  | { kind: 'invalid_amount' }
  | { kind: 'created'; booking: CustomerBookingCreated }
> {
  return withTransaction(async (client) => {
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
      workshopTitle: string;
      effectiveDepositPercent: number;
    }>(
      `SELECT s.price,
         s.starts_at AS "startsAt",
         w.title AS "workshopTitle",
         CASE WHEN ${studioDepositEligibleSql} THEN w.deposit_percent ELSE 0 END
           AS "effectiveDepositPercent"
       FROM sessions s
       JOIN workshops w ON w.id = s.workshop_id
       JOIN studios st ON st.id = w.studio_id
       WHERE s.id = $1
         AND s.status = 'scheduled'
         AND s.starts_at > now()
         AND w.status = 'approved'
         AND NOT w.is_simulated
         AND w.visibility_status = 'active'
         AND w.publication_status = 'published'
         AND st.status = 'approved'
         AND NOT st.is_hidden
         AND NOT st.is_draft
         AND studio_profile_complete(st)`,
      [input.sessionId],
    );
    const session = details.rows[0];
    if (!session) return { kind: 'not_found' as const };

    const totalAmount = session.price * input.quantity;
    if (!Number.isSafeInteger(totalAmount) || totalAmount > 2_147_483_647) {
      return { kind: 'invalid_amount' as const };
    }

    const paymentMode =
      totalAmount === 0
        ? 'free'
        : session.effectiveDepositPercent > 0
          ? 'payos_deposit'
          : 'in_studio';
    const depositAmount =
      paymentMode === 'payos_deposit'
        ? Math.ceil((totalAmount * session.effectiveDepositPercent) / 100)
        : 0;
    const balanceAmount = totalAmount - depositAmount;

    const reserved =
      paymentMode === 'payos_deposit'
        ? await client.query<{ price: number }>(
            `UPDATE sessions
             SET seats_held = seats_held + $1
             WHERE id = $2
               AND status = 'scheduled'
               AND starts_at > now()
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
         contact_phone, deposit_amount, paid_amount, payment_mode
       )
       VALUES (
         $1, $2, $3, $4, $5, $6::booking_status,
         CASE WHEN $7::boolean
           THEN LEAST(now() + make_interval(mins => $8), $9::timestamptz)
           ELSE $9
         END,
         $10, $11, $12, $13, $14, $15, $16
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
        holdMinutes,
        session.startsAt,
        orderCode,
        paymentMode === 'payos_deposit' ? 'pending' : 'confirmed',
        input.contactName,
        input.contactPhone,
        depositAmount,
        paymentMode === 'free' ? totalAmount : 0,
        paymentMode,
      ],
    );
    const booking = inserted.rows[0];

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
      await issueTickets(client, booking.id, input.quantity);
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
): Promise<void> {
  await withTransaction(async (client) => {
    const result = await client.query(
      `UPDATE payments p
       SET checkout_url = $3,
           provider_ref = $4
       FROM bookings b
       WHERE p.booking_id = b.id
         AND b.id = $1
         AND p.kind = 'deposit'
         AND p.provider = $2
         AND p.status = 'created'`,
      [bookingId, provider, checkoutUrl, providerRef],
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

export async function getCustomerBooking(userId: string, bookingId: string) {
  const result = await query(
    `SELECT b.id, b.order_code::text AS "orderCode",
       b.session_id AS "sessionId", b.quantity, b.unit_price AS "unitPrice",
       b.total_amount AS "totalAmount", b.deposit_amount AS "depositAmount",
       b.paid_amount AS "paidAmount", b.total_amount-b.paid_amount AS "balanceAmount",
       b.status AS "paymentStatus", b.reservation_status AS "reservationStatus",
       b.payment_mode AS "paymentMode", b.hold_expires_at AS "holdExpiresAt",
       COALESCE(b.contact_name, u.full_name) AS "contactName", COALESCE(b.contact_phone, u.phone, '') AS "contactPhone",
       b.created_at AS "createdAt", b.paid_at AS "paidAt",
       s.starts_at AS "startsAt", s.ends_at AS "endsAt",
       w.id AS "workshopId", w.title AS "workshopTitle",
       st.name AS "studioName", st.address,
       COALESCE(json_agg(
         json_build_object(
           'provider', p.provider, 'kind', p.kind, 'amount', p.amount,
           'status', p.status, 'checkoutUrl', p.checkout_url, 'paidAt', p.paid_at
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
}

export async function listCustomerBookings(userId: string) {
  const result = await query(
    `SELECT b.id, b.order_code::text AS "orderCode",
       b.quantity, b.total_amount AS "totalAmount",
       b.deposit_amount AS "depositAmount", b.paid_amount AS "paidAmount",
       b.total_amount-b.paid_amount AS "balanceAmount",
       b.status AS "paymentStatus", b.reservation_status AS "reservationStatus",
       b.payment_mode AS "paymentMode", b.created_at AS "createdAt",
       s.starts_at AS "startsAt", w.title AS "workshopTitle",
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
       b.total_amount-b.paid_amount AS "balanceAmount",
       b.status AS "paymentStatus", b.reservation_status AS "reservationStatus",
       s.starts_at AS "startsAt", w.title AS "workshopTitle"
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
    `SELECT id, seq, code, status, issued_at AS "issuedAt"
     FROM tickets
     WHERE booking_id = $1
     ORDER BY seq`,
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
