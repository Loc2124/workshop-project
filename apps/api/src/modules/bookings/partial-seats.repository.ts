import type { PoolClient } from 'pg';
import { randomBytes } from 'node:crypto';
import { cancellationRefund } from '@workshop/shared';
import { query, withTransaction } from '../../db/pool.js';
import { AppError } from '../../errors/app-error.js';
import { loadConfig } from '../../config.js';
import { writeAuditLog } from '../admin/audit-log.js';
import { releaseExpiredHolds } from './bookings.repository.js';
import {
  createCancellationQuote,
  cancellationQuoteMatches,
  type CancellationSnapshot,
} from './cancellation-quote.js';
import type { WebhookVerification } from '../payments/providers/payment-provider.js';

type Seat = {
  id: string;
  seq: number;
  state: 'active' | 'cancelled';
  totalAmount: number;
  depositAmount: number;
  paidAmount: number;
  refundDueAmount: number;
  refundedAmount: number;
  attendanceStatus: string;
};
type Booking = {
  id: string;
  userId: string;
  sessionId: string;
  quantity: number;
  originalQuantity: number;
  totalAmount: number;
  depositAmount: number;
  paidAmount: number;
  status: string;
  reservationStatus: string;
  paymentMode: string;
  holdExpiresAt: Date;
  seatRevision: number;
  checkoutRevision: number;
  startsAt: Date;
  endsAt: Date;
  sessionStatus: string;
  scheduleVersion: number;
  acceptedScheduleVersion: number;
  reschedulePending: boolean;
  now: Date;
};
const err = (message: string, status: 404 | 409 | 422 = 409) => ({
  error: new AppError(
    status,
    status === 404
      ? 'NOT_FOUND'
      : status === 422
        ? 'UNPROCESSABLE_ENTITY'
        : 'CONFLICT',
    message,
  ),
});

async function lock(client: PoolClient, bookingId: string, userId?: string) {
  const target = (
    await client.query<{ sessionId: string }>(
      'SELECT session_id AS "sessionId" FROM bookings WHERE id=$1 AND ($2::uuid IS NULL OR user_id=$2)',
      [bookingId, userId ?? null],
    )
  ).rows[0];
  if (!target) return null;
  await releaseExpiredHolds(client, [target.sessionId]);
  const booking = (
    await client.query<Booking>(
      `SELECT b.id,b.user_id AS "userId",b.session_id AS "sessionId",b.quantity,b.original_quantity AS "originalQuantity",b.total_amount AS "totalAmount",b.deposit_amount AS "depositAmount",b.paid_amount AS "paidAmount",b.status,b.reservation_status AS "reservationStatus",b.payment_mode AS "paymentMode",b.hold_expires_at AS "holdExpiresAt",b.seat_revision AS "seatRevision",b.checkout_revision AS "checkoutRevision",s.starts_at AS "startsAt",s.ends_at AS "endsAt",s.status AS "sessionStatus",s.schedule_version AS "scheduleVersion",b.schedule_version AS "acceptedScheduleVersion",b.reschedule_pending AS "reschedulePending",clock_timestamp() AS now FROM bookings b JOIN sessions s ON s.id=b.session_id WHERE b.id=$1 FOR UPDATE OF b`,
      [bookingId],
    )
  ).rows[0]!;
  const seats = (
    await client.query<Seat>(
      `SELECT bs.id,bs.seq,bs.state,bs.total_amount AS "totalAmount",bs.deposit_amount AS "depositAmount",bs.paid_amount AS "paidAmount",bs.refund_due_amount AS "refundDueAmount",bs.refunded_amount AS "refundedAmount",COALESCE(t.attendance_status,'unmarked') AS "attendanceStatus" FROM booking_seats bs LEFT JOIN tickets t ON t.booking_id=bs.booking_id AND t.seq=bs.seq WHERE bs.booking_id=$1 ORDER BY bs.seq FOR UPDATE OF bs`,
      [bookingId],
    )
  ).rows;
  return { booking, seats };
}
function selection(
  context: { booking: Booking; seats: Seat[] },
  sequences?: readonly number[],
) {
  const chosen =
    sequences ??
    context.seats.filter((s) => s.state === 'active').map((s) => s.seq);
  if (
    !chosen.length ||
    chosen.length > 10 ||
    new Set(chosen).size !== chosen.length
  )
    return null;
  const seats = chosen.map((seq) => context.seats.find((s) => s.seq === seq));
  if (
    seats.some(
      (s) => !s || s.state !== 'active' || s.attendanceStatus === 'attended',
    )
  )
    return null;
  if (
    !['pending', 'confirmed', 'completed'].includes(
      context.booking.reservationStatus,
    ) ||
    ['expired', 'cancelled', 'refund_needed'].includes(context.booking.status)
  )
    return null;
  return (seats as Seat[]).sort((a, b) => a.seq - b.seq);
}
function snapshot(
  context: { booking: Booking; seats: Seat[] },
  chosen: Seat[],
): CancellationSnapshot {
  const b = context.booking;
  return {
    id: b.id,
    userId: b.userId,
    quantity: chosen.length,
    paidAmount: chosen.reduce((n, s) => n + s.paidAmount, 0),
    depositAmount: chosen.reduce((n, s) => n + s.depositAmount, 0),
    status: b.status,
    reservationStatus: b.reservationStatus,
    startsAt: b.startsAt,
    endsAt: b.endsAt,
    sessionStatus: b.sessionStatus,
    reschedulePending: b.reschedulePending,
    scheduleVersion: b.scheduleVersion,
    selectionKey: JSON.stringify([
      b.seatRevision,
      b.quantity,
      b.holdExpiresAt,
      context.seats,
    ]),
    seats: chosen,
  };
}
function minimumProblem(
  context: { booking: Booking; seats: Seat[] },
  chosen: Seat[],
) {
  const left = context.seats.filter(
    (s) => s.state === 'active' && !chosen.some((c) => c.seq === s.seq),
  );
  if (!left.length) return false;
  const due = left.reduce((n, s) => n + s.depositAmount, 0),
    total = left.reduce((n, s) => n + s.totalAmount, 0),
    minimum = Number(process.env.PAYMENT_MIN_AMOUNT ?? 0);
  return (
    due > total ||
    left.reduce((n, s) => n + s.paidAmount, 0) > total ||
    (context.booking.reservationStatus === 'pending' &&
      due > 0 &&
      minimum > 0 &&
      due < minimum)
  );
}
export async function listCustomerSeats(userId: string, bookingId: string) {
  const result = await withTransaction(async (client) => {
    const context = await lock(client, bookingId, userId);
    if (!context) return err('Không tìm thấy đặt chỗ.', 404);
    return {
      seats: context.seats.map((s) => ({
        ...s,
        state:
          s.state === 'active' && context.booking.status === 'expired'
            ? 'expired'
            : s.state,
        canCancel:
          s.state === 'active' &&
          s.attendanceStatus !== 'attended' &&
          ['pending', 'confirmed', 'completed'].includes(
            context.booking.reservationStatus,
          ) &&
          !['expired', 'cancelled', 'refund_needed'].includes(
            context.booking.status,
          ),
      })),
    };
  });
  if ('error' in result) throw result.error;
  return result;
}
export async function quoteSeatCancellation(
  userId: string,
  bookingId: string,
  sequences?: readonly number[],
) {
  const result = await withTransaction(async (client) => {
    const context = await lock(client, bookingId, userId);
    if (!context) return err('Không tìm thấy đặt chỗ.', 404);
    const chosen = selection(context, sequences);
    if (!chosen)
      return err('Các chỗ đã chọn đã thay đổi hoặc không còn có thể hủy.');
    if (minimumProblem(context, chosen))
      return err(
        'Tiền cọc cho số chỗ còn lại thấp hơn mức hỗ trợ. Bạn có thể hủy toàn bộ hoặc liên hệ studio.',
        422,
      );
    return {
      quote: {
        ...createCancellationQuote(
          snapshot(context, chosen),
          context.booking.now.getTime(),
          loadConfig().JWT_SECRET,
        ),
        sequences: chosen.map((s) => s.seq),
        remainingQuantity:
          context.seats.filter((s) => s.state === 'active').length -
          chosen.length,
      },
    };
  });
  if ('error' in result) throw result.error;
  return result;
}
export async function synchronizePartialTotals(
  client: PoolClient,
  bookingId: string,
  reservationStatus?: string,
) {
  await client.query(
    "SELECT set_config('app.partial_seat_operation','true',true)",
  );
  await client.query(
    `WITH amounts AS (SELECT count(*) FILTER(WHERE bs.state='active')::integer AS qty,
  count(*) FILTER(WHERE bs.state='active' AND t.attendance_status='attended')::integer AS attended,
  count(*) FILTER(WHERE bs.state='active' AND t.attendance_status='absent')::integer AS absent,
  COALESCE(sum(bs.total_amount) FILTER(WHERE bs.state='active'),0)::integer AS total,COALESCE(sum(bs.deposit_amount) FILTER(WHERE bs.state='active'),0)::integer AS deposit,
  COALESCE(sum(bs.paid_amount) FILTER(WHERE bs.state='active'),0)::integer AS paid,COALESCE(sum(bs.refund_due_amount),0)::integer AS due,COALESCE(sum(bs.refunded_amount),0)::integer AS refunded FROM booking_seats bs LEFT JOIN tickets t ON t.booking_id=bs.booking_id AND t.seq=bs.seq WHERE bs.booking_id=$1)
  UPDATE bookings b SET quantity=CASE WHEN a.qty>0 THEN a.qty ELSE b.quantity END,total_amount=CASE WHEN a.qty>0 THEN a.total ELSE b.total_amount END,
  deposit_amount=CASE WHEN a.qty>0 THEN a.deposit ELSE b.deposit_amount END,paid_amount=CASE WHEN a.qty>0 THEN a.paid ELSE b.paid_amount END,
  refund_due_amount=a.due,refunded_amount=a.refunded,
  reservation_status=CASE WHEN a.qty=0 THEN 'cancelled' WHEN COALESCE($2::text,b.reservation_status) IN ('confirmed','completed') THEN CASE WHEN a.attended=a.qty THEN 'completed' ELSE 'confirmed' END ELSE 'pending' END,
  attendance_status=CASE WHEN a.qty=0 THEN b.attendance_status WHEN a.attended=a.qty THEN 'attended' WHEN a.absent=a.qty THEN 'absent' ELSE 'unmarked' END,
  status=CASE WHEN a.qty=0 THEN CASE WHEN a.due+b.extra_refund_due_amount>a.refunded+b.extra_refunded_amount THEN 'refund_needed'::booking_status ELSE 'cancelled'::booking_status END
    WHEN COALESCE($2::text,b.reservation_status) IN ('confirmed','completed') AND a.paid>=a.total THEN 'paid'::booking_status ELSE 'pending'::booking_status END,
  refund_status=CASE WHEN a.due+b.extra_refund_due_amount>a.refunded+b.extra_refunded_amount THEN 'pending' WHEN a.due+b.extra_refund_due_amount>0 THEN 'refunded'
   WHEN EXISTS(SELECT 1 FROM booking_seats s WHERE s.booking_id=b.id AND s.state='cancelled' AND s.paid_amount>s.refund_due_amount) THEN 'forfeited' ELSE 'not_applicable' END
  FROM amounts a WHERE b.id=$1`,
    [bookingId, reservationStatus ?? null],
  );
  await client.query(
    `UPDATE payments p SET amount=CASE WHEN b.reservation_status='pending' THEN b.total_amount-b.deposit_amount ELSE b.total_amount-b.paid_amount END FROM bookings b WHERE p.booking_id=b.id AND b.id=$1 AND p.provider='in_studio' AND p.status='created' AND b.reservation_status<>'cancelled'`,
    [bookingId],
  );
}
export async function cancelBookingSeats(
  userId: string,
  bookingId: string,
  sequences: readonly number[] | undefined,
  quoteToken?: string,
) {
  const result = await withTransaction(async (client) => {
    const context = await lock(client, bookingId, userId);
    if (!context) return err('Không tìm thấy đặt chỗ.', 404);
    const chosen = selection(context, sequences);
    if (!chosen) return err('Các chỗ đã chọn đã thay đổi hoặc đã được hủy.');
    const b = context.booking;
    if (
      (quoteToken || b.paidAmount > 0) &&
      (!quoteToken ||
        !cancellationQuoteMatches(
          quoteToken,
          snapshot(context, chosen),
          b.now.getTime(),
          loadConfig().JWT_SECRET,
        ))
    )
      return {
        error: new AppError(
          409,
          'CANCELLATION_QUOTE_CHANGED',
          'Thông tin hủy đã thay đổi. Vui lòng xem lại và xác nhận lần nữa.',
        ),
      };
    if (minimumProblem(context, chosen))
      return err(
        'Tiền cọc cho số chỗ còn lại thấp hơn mức hỗ trợ. Bạn có thể hủy toàn bộ hoặc liên hệ studio.',
        422,
      );
    await client.query(
      "SELECT set_config('app.partial_seat_operation','true',true),set_config('app.booking_actor',$1,true),set_config('app.booking_reason','Khách xác nhận hủy từng chỗ theo khoản hoàn đã xem.',true)",
      [userId],
    );
    for (const s of chosen) {
      const refund = cancellationRefund(
        s.paidAmount,
        b.startsAt,
        b.now.getTime(),
        b.reschedulePending || b.sessionStatus === 'cancelled',
        s.depositAmount,
      );
      await client.query(
        "UPDATE booking_seats SET state='cancelled',cancelled_at=clock_timestamp(),refund_due_amount=GREATEST(refund_due_amount,$2) WHERE id=$1",
        [s.id, refund.refundDue],
      );
    }
    await client.query(
      `UPDATE tickets t SET status='void',refund_due_amount=s.refund_due_amount,refund_history_locked=t.refund_history_locked OR s.refund_due_amount>0,
    refund_started_at=CASE WHEN s.refund_due_amount>0 THEN COALESCE(t.refund_started_at,clock_timestamp()) ELSE t.refund_started_at END
    FROM booking_seats s WHERE s.booking_id=$1 AND t.booking_id=s.booking_id AND t.seq=s.seq AND s.seq=ANY($2::integer[])`,
      [bookingId, chosen.map((s) => s.seq)],
    );
    const seatColumn =
      b.reservationStatus === 'pending' ? 'seats_held' : 'seats_sold';
    if (
      !(
        await client.query(
          `UPDATE sessions SET ${seatColumn}=${seatColumn}-$2 WHERE id=$1 AND ${seatColumn}>=$2 RETURNING id`,
          [b.sessionId, chosen.length],
        )
      ).rowCount
    )
      throw new Error('Cancelled seat count exceeds allocations.');
    await client.query(
      'UPDATE bookings SET seat_revision=seat_revision+1 WHERE id=$1',
      [bookingId],
    );
    const left = context.seats.filter(
      (s) => s.state === 'active' && !chosen.some((c) => c.seq === s.seq),
    );
    let paymentId: string | null = null;
    if (b.reservationStatus === 'pending') {
      await client.query(
        "UPDATE payments SET status='cancelled',checkout_setup='superseded' WHERE booking_id=$1 AND kind='deposit' AND status='created'",
        [bookingId],
      );
      await client.query(
        'UPDATE bookings SET checkout_revision=checkout_revision+1 WHERE id=$1',
        [bookingId],
      );
      const deposit = left.reduce((n, s) => n + s.depositAmount, 0);
      if (left.length && deposit > 0) {
        paymentId = (
          await client.query<{ id: string }>(
            `INSERT INTO payments(booking_id,provider,order_code,amount,status,kind,checkout_revision,checkout_setup)
      SELECT b.id,COALESCE((SELECT provider FROM payments WHERE booking_id=b.id AND kind='deposit' ORDER BY created_at DESC LIMIT 1),$2),nextval('booking_order_code_seq'),$3,'created','deposit',b.checkout_revision,'pending' FROM bookings b WHERE b.id=$1 RETURNING id`,
            [bookingId, loadConfig().PAYMENT_PROVIDER, deposit],
          )
        ).rows[0]!.id;
      }
    }
    const confirmedZero =
      b.reservationStatus === 'pending' &&
      left.length > 0 &&
      left.every((s) => s.depositAmount === 0);
    if (confirmedZero) {
      const moved = await client.query(
        'UPDATE sessions SET seats_held=seats_held-$2,seats_sold=seats_sold+$2 WHERE id=$1 AND seats_held>=$2 RETURNING id',
        [b.sessionId, left.length],
      );
      if (!moved.rowCount) throw new Error('Remaining holds are inconsistent.');
    }
    await synchronizePartialTotals(
      client,
      bookingId,
      confirmedZero ? 'confirmed' : undefined,
    );
    if (confirmedZero) await issueActiveSeatTickets(client, bookingId);
    if (!left.length)
      await client.query(
        "UPDATE payments SET status='cancelled' WHERE booking_id=$1 AND status='created'",
        [bookingId],
      );
    await writeAuditLog(client, {
      actorId: userId,
      action: 'booking.seats.cancelled',
      targetType: 'booking',
      targetId: bookingId,
      targetName: 'Hủy từng chỗ',
      before: { quantity: b.quantity, seats: chosen },
      after: {
        cancelledSequences: chosen.map((s) => s.seq),
        remainingQuantity: left.length,
        holdExpiresAt: b.holdExpiresAt,
        paymentId,
      },
    });
    await client.query(
      `INSERT INTO user_notifications(user_id,booking_id,type,title,body,href) VALUES($1::uuid,$2::uuid,'booking_seats_cancelled','Đã hủy chỗ đã chọn',$3,'/me/bookings/'||$2::uuid::text)`,
      [
        userId,
        bookingId,
        `Đã hủy ${chosen.length} chỗ. ${left.length ? `Còn ${left.length} chỗ theo lịch đã đặt.` : 'Không còn chỗ được giữ trong đặt chỗ này.'}`,
      ],
    );
    return { ok: true, paymentId, remainingQuantity: left.length };
  });
  if ('error' in result) throw result.error;
  return result;
}
export async function issueActiveSeatTickets(
  client: PoolClient,
  bookingId: string,
) {
  const seats = (
    await client.query<{ seq: number }>(
      "SELECT seq FROM booking_seats WHERE booking_id=$1 AND state='active' ORDER BY seq",
      [bookingId],
    )
  ).rows;
  for (const seat of seats)
    await client.query(
      'INSERT INTO tickets(booking_id,seq,code) VALUES($1,$2,$3) ON CONFLICT(booking_id,seq) DO NOTHING',
      [bookingId, seat.seq, randomBytes(18).toString('base64url')],
    );
}
export async function isPartialBooking(bookingId: string, userId: string) {
  return Boolean(
    (
      await query(
        'SELECT 1 FROM bookings WHERE id=$1 AND user_id=$2 AND seat_revision>0',
        [bookingId, userId],
      )
    ).rowCount,
  );
}

/** Called after session + booking + payment locks and signature/amount verification. */
export async function processPartialDeposit(
  client: PoolClient,
  bookingId: string,
  paymentId: string,
  eventId: string,
  verification: WebhookVerification,
) {
  const context = await lock(client, bookingId);
  if (!context) throw new Error('Payment booking disappeared.');
  const b = context.booking,
    active = context.seats.filter((s) => s.state === 'active');
  const payment = (
    await client.query<{
      status: string;
      amount: number;
      providerRef: string | null;
      revision: number;
    }>(
      'SELECT status,amount,provider_ref AS "providerRef",checkout_revision AS revision FROM payments WHERE id=$1 FOR UPDATE',
      [paymentId],
    )
  ).rows[0]!;
  const additional = payment.status === 'paid';
  if (
    additional &&
    (!verification.success ||
      !verification.providerRef ||
      verification.providerRef === payment.providerRef)
  )
    return 'duplicate';
  if (!verification.success) {
    await client.query(
      "UPDATE payments SET status='failed' WHERE id=$1 AND status='created'",
      [paymentId],
    );
    if (
      payment.revision === b.checkoutRevision &&
      b.reservationStatus === 'pending' &&
      b.status === 'pending'
    ) {
      if (
        !(
          await client.query(
            'UPDATE sessions SET seats_held=seats_held-$2 WHERE id=$1 AND seats_held>=$2 RETURNING id',
            [b.sessionId, active.length],
          )
        ).rowCount
      )
        throw new Error('Failed payment holds are inconsistent.');
      await client.query(
        "UPDATE booking_seats SET state='cancelled',cancelled_at=clock_timestamp() WHERE booking_id=$1 AND state='active'",
        [bookingId],
      );
      await synchronizePartialTotals(client, bookingId);
    }
    return 'payment_failed';
  }
  if (!additional)
    await client.query(
      "UPDATE payments SET status='paid',provider_ref=$2,paid_at=clock_timestamp(),checkout_setup='superseded' WHERE id=$1",
      [paymentId, verification.providerRef],
    );
  let applied = 0,
    canConfirm = false;
  const publicSlot = await client.query(
    `SELECT 1 FROM sessions s JOIN workshops w ON w.id=s.workshop_id JOIN studios st ON st.id=w.studio_id WHERE s.id=$1 AND s.status='scheduled' AND s.starts_at>clock_timestamp() AND COALESCE(s.registration_deadline,s.starts_at)>clock_timestamp()
   AND w.status='approved' AND NOT w.is_simulated AND NOT w.is_discontinued AND w.visibility_status='active' AND w.publication_status='published'
   AND st.status='approved' AND NOT st.is_hidden AND NOT st.is_draft AND studio_profile_complete(st)`,
    [b.sessionId],
  );
  const needed = active.reduce(
    (n, s) => n + Math.max(0, s.depositAmount - s.paidAmount),
    0,
  );
  if (
    !additional &&
    active.length &&
    (b.reservationStatus === 'pending' || b.status === 'expired') &&
    ['pending', 'expired'].includes(b.status) &&
    b.scheduleVersion === b.acceptedScheduleVersion &&
    publicSlot.rowCount &&
    payment.amount >= needed
  ) {
    if (b.status === 'expired') {
      canConfirm = Boolean(
        (
          await client.query(
            'UPDATE sessions SET seats_sold=seats_sold+$2 WHERE id=$1 AND seats_held+seats_sold+$2<=capacity RETURNING id',
            [b.sessionId, active.length],
          )
        ).rowCount,
      );
    } else {
      canConfirm = Boolean(
        (
          await client.query(
            'UPDATE sessions SET seats_held=seats_held-$2,seats_sold=seats_sold+$2 WHERE id=$1 AND seats_held>=$2 RETURNING id',
            [b.sessionId, active.length],
          )
        ).rowCount,
      );
    }
    if (canConfirm) {
      for (const s of active) {
        const amount = Math.max(0, s.depositAmount - s.paidAmount);
        await client.query(
          'UPDATE booking_seats SET paid_amount=paid_amount+$2 WHERE id=$1',
          [s.id, amount],
        );
        applied += amount;
      }
    }
  }
  const excess = payment.amount - applied;
  if (excess > 0) {
    const added = await client.query(
      'INSERT INTO booking_extra_refunds(payment_id,booking_id,source_event_id,provider_ref,amount,reason) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING RETURNING id',
      [
        paymentId,
        bookingId,
        eventId,
        verification.providerRef,
        excess,
        canConfirm ? 'old_checkout_excess' : 'unapplied_deposit',
      ],
    );
    if (added.rowCount)
      await client.query(
        'UPDATE bookings SET extra_received_amount=extra_received_amount+$2,extra_refund_due_amount=extra_refund_due_amount+$2 WHERE id=$1',
        [bookingId, excess],
      );
  }
  if (
    canConfirm ||
    b.reservationStatus !== 'pending' ||
    !publicSlot.rowCount ||
    b.scheduleVersion !== b.acceptedScheduleVersion
  )
    await client.query(
      "UPDATE payments SET status='cancelled',checkout_setup='superseded' WHERE booking_id=$1 AND kind='deposit' AND status='created'",
      [bookingId],
    );
  if (canConfirm) {
    await synchronizePartialTotals(client, bookingId, 'confirmed');
    await issueActiveSeatTickets(client, bookingId);
  } else {
    if (
      b.reservationStatus === 'pending' &&
      b.status === 'pending' &&
      (!publicSlot.rowCount || b.scheduleVersion !== b.acceptedScheduleVersion)
    ) {
      if (
        !(
          await client.query(
            'UPDATE sessions SET seats_held=seats_held-$2 WHERE id=$1 AND seats_held>=$2 RETURNING id',
            [b.sessionId, active.length],
          )
        ).rowCount
      )
        throw new Error('Closed-session holds are inconsistent.');
      await client.query(
        "UPDATE booking_seats SET state='cancelled',cancelled_at=clock_timestamp() WHERE booking_id=$1 AND state='active'",
        [bookingId],
      );
      await synchronizePartialTotals(client, bookingId);
    }
    // Money that cannot confirm a hold never buys cancelled seats. Keep expired or
    // already-confirmed state; other valid holds may still receive their current QR.
    await client.query(
      `UPDATE bookings SET refund_status=CASE WHEN refund_due_amount+extra_refund_due_amount>refunded_amount+extra_refunded_amount THEN 'pending' ELSE refund_status END,status=CASE WHEN reservation_status='cancelled' AND status<>'expired' THEN 'refund_needed'::booking_status ELSE status END WHERE id=$1`,
      [bookingId],
    );
  }
  await client.query(
    `INSERT INTO user_notifications(user_id,booking_id,type,title,body,href) VALUES($1::uuid,$2::uuid,'partial_deposit_received',$3,$4,'/me/bookings/'||$2::uuid::text)`,
    [
      b.userId,
      bookingId,
      canConfirm
        ? 'Đã xác nhận các chỗ còn lại'
        : 'Đã nhận khoản tiền cần hoàn',
      canConfirm
        ? `Đã dùng ${applied.toLocaleString('vi-VN')} đ xác nhận ${active.length} chỗ.${excess ? ` Phần dư ${excess.toLocaleString('vi-VN')} đ được ghi nhận để hoàn trong tối đa 7 ngày làm việc.` : ''}`
        : `Khoản ${excess.toLocaleString('vi-VN')} đ được ghi nhận để hoàn trong tối đa 7 ngày làm việc. Các chỗ đã hủy không được khôi phục.`,
    ],
  );
  return canConfirm ? 'partial_deposit_confirmed' : 'partial_deposit_refund';
}
