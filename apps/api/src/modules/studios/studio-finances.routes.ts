import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth.js';
import { validateUuidParam } from '../../middleware/validate-uuid-param.js';
import { query } from '../../db/pool.js';
import { AppError } from '../../errors/app-error.js';
import { syncRefundObligations } from '../payments/financial-obligation-job.js';

export const financesPeriodSchema = z
  .enum(['all', 'this_month', 'last_month'])
  .default('all');

export type FinancesPeriod = z.infer<typeof financesPeriodSchema>;

export function financesPeriodRange(
  period: FinancesPeriod,
  now = new Date(),
): { start: string; end: string } | null {
  if (period === 'all') return null;
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(now);
  const year = Number(parts.find((p) => p.type === 'year')?.value);
  const month = Number(parts.find((p) => p.type === 'month')?.value);

  const isoStartOfMonth = (y: number, m: number) => {
    const normalizedYear = y + Math.floor((m - 1) / 12);
    const normalizedMonth = ((((m - 1) % 12) + 12) % 12) + 1;
    return `${String(normalizedYear).padStart(4, '0')}-${String(normalizedMonth).padStart(2, '0')}-01T00:00:00+07:00`;
  };

  if (period === 'this_month') {
    return {
      start: isoStartOfMonth(year, month),
      end: isoStartOfMonth(year, month + 1),
    };
  }
  return {
    start: isoStartOfMonth(year, month - 1),
    end: isoStartOfMonth(year, month),
  };
}

export const studioFinancesRouter = Router();
const path = '/:studioId/finances';
studioFinancesRouter.use(path, requireAuth(), validateUuidParam('studioId'));

studioFinancesRouter.get(path, async (req, res) => {
  const studioId = String(req.params.studioId);
  const owner = await query(
    `SELECT 1 FROM studio_members WHERE studio_id=$1 AND user_id=$2 AND role='owner'`,
    [studioId, req.user!.sub],
  );
  if (!owner.rowCount) {
    throw new AppError(
      403,
      'FORBIDDEN',
      'Chỉ chủ studio mới xem được thông tin tài chính và quyết toán.',
    );
  }

  // Trigger đồng bộ các nghĩa vụ và quyết toán cho các buổi học vừa hoàn tất
  try {
    await syncRefundObligations();
  } catch (err) {
    console.error('Failed to sync obligations on studio finances query:', err);
  }

  const period = financesPeriodSchema.parse(req.query.period);
  const range = financesPeriodRange(period);

  // 1. Tài khoản nhận tiền hiện tại
  const accountQuery = await query<{
    id: string;
    bankName: string | null;
    bankBin: string | null;
    accountHolder: string;
    last4: string;
    status: 'pending' | 'verified' | 'rejected';
  }>(
    `SELECT id, bank_name AS "bankName", bank_bin AS "bankBin", account_holder AS "accountHolder",
            account_last4 AS "last4", status
     FROM studio_payout_accounts
     WHERE studio_id = $1 AND is_current
     LIMIT 1`,
    [studioId],
  );
  const currentAccount = accountQuery.rows[0] ?? null;

  // 2. Danh sách các đợt quyết toán chi trả (studio_payout)
  const settlementsQuery = await query<{
    id: string;
    bookingId: string;
    orderCode: string;
    workshopTitle: string;
    sessionStartsAt: Date;
    sessionEndsAt: Date | null;
    amount: string;
    dueAt: Date | null;
    status: string;
    collectedDeposit: string;
    directAmount: string;
    isDirectPaid: boolean;
    refundsRecorded: string;
    feesRecorded: string;
    breakdown: unknown;
    transfers: Array<{
      id: string;
      amount: number;
      status: string;
      provider: string | null;
      reference: string | null;
      settledAt: string | null;
      bankName: string | null;
      accountLast4: string | null;
    }>;
  }>(
    `SELECT o.id, o.booking_id AS "bookingId", b.order_code::text AS "orderCode",
       w.title AS "workshopTitle", s.starts_at AS "sessionStartsAt", s.ends_at AS "sessionEndsAt",
       o.amount::text AS "amount", o.due_at AS "dueAt", o.status,
       COALESCE((SELECT sum(p.amount) FROM payments p WHERE p.booking_id=b.id AND p.kind='deposit' AND p.status='paid'), b.deposit_amount, 0)::text AS "collectedDeposit",
       GREATEST(0, b.total_amount - b.deposit_amount)::text AS "directAmount",
       (b.paid_amount >= b.total_amount) AS "isDirectPaid",
       (b.refund_due_amount + b.extra_refund_due_amount)::text AS "refundsRecorded",
       COALESCE((SELECT sum(t.provider_fee) FROM financial_transfers t WHERE t.obligation_id=o.id AND t.direction='outbound' AND t.status='succeeded'),0)::text AS "feesRecorded",
       o.payout_snapshot AS "breakdown",
       COALESCE(json_agg(
         json_build_object(
           'id', t.id,
           'amount', t.amount::bigint,
           'status', t.status,
           'provider', t.provider,
           'reference', t.reference,
           'settledAt', t.settled_at,
           'bankName', a.bank_name,
           'accountLast4', a.account_last4
         ) ORDER BY t.created_at DESC
       ) FILTER (WHERE t.id IS NOT NULL), '[]'::json) AS transfers
     FROM financial_obligations o
     JOIN bookings b ON b.id = o.booking_id
     JOIN sessions s ON s.id = b.session_id
     JOIN workshops w ON w.id = s.workshop_id
     LEFT JOIN financial_transfers t ON t.obligation_id = o.id AND t.direction = 'outbound' AND t.purpose = 'studio_payout'
     LEFT JOIN studio_payout_accounts a ON a.id = t.destination_studio_account_id
     WHERE o.studio_id = $1
       AND o.kind = 'studio_payout'
       AND o.status <> 'cancelled'
       AND ($2::timestamptz IS NULL OR COALESCE(s.ends_at, o.created_at) >= $2::timestamptz)
       AND ($3::timestamptz IS NULL OR COALESCE(s.ends_at, o.created_at) < $3::timestamptz)
     GROUP BY o.id, b.id, w.id, s.id

     UNION ALL

     SELECT
       b.id AS id, b.id AS "bookingId", b.order_code::text AS "orderCode",
       w.title AS "workshopTitle", s.starts_at AS "sessionStartsAt", s.ends_at AS "sessionEndsAt",
       GREATEST(
         0,
         COALESCE(
           (SELECT sum(p.amount) FROM payments p WHERE p.booking_id=b.id AND p.kind='deposit' AND p.status='paid'),
           b.deposit_amount,
           0
         ) - b.refund_due_amount - b.extra_refund_due_amount
       )::text AS "amount",
       financial_obligation_deadline('studio_payout', s.ends_at) AS "dueAt",
       'awaiting_approval' AS status,
       COALESCE(
         (SELECT sum(p.amount) FROM payments p WHERE p.booking_id=b.id AND p.kind='deposit' AND p.status='paid'),
         b.deposit_amount,
         0
       )::text AS "collectedDeposit",
       GREATEST(0, b.total_amount - b.deposit_amount)::text AS "directAmount",
       (b.paid_amount >= b.total_amount) AS "isDirectPaid",
       (b.refund_due_amount + b.extra_refund_due_amount)::text AS "refundsRecorded",
       '0' AS "feesRecorded",
       json_build_object(
         'sessionId', s.id,
         'collected', COALESCE((SELECT sum(p.amount) FROM payments p WHERE p.booking_id=b.id AND p.kind='deposit' AND p.status='paid'), b.deposit_amount, 0)::text,
         'refundsRecorded', (b.refund_due_amount + b.extra_refund_due_amount)::text,
         'payout', GREATEST(0, COALESCE((SELECT sum(p.amount) FROM payments p WHERE p.booking_id=b.id AND p.kind='deposit' AND p.status='paid'), b.deposit_amount, 0) - b.refund_due_amount - b.extra_refund_due_amount)::text
       )::jsonb AS "breakdown",
       '[]'::json AS transfers
     FROM bookings b
     JOIN sessions s ON s.id = b.session_id
     JOIN workshops w ON w.id = s.workshop_id
     WHERE w.studio_id = $1
       AND b.reservation_status IN ('confirmed', 'completed')
       AND s.ends_at <= clock_timestamp()
       AND b.payment_mode = 'payos_deposit'
       AND b.paid_amount >= b.deposit_amount
       AND NOT EXISTS (
         SELECT 1 FROM financial_obligations fo
         WHERE fo.booking_id = b.id AND fo.kind = 'studio_payout' AND fo.status <> 'cancelled'
       )
       AND ($2::timestamptz IS NULL OR s.ends_at >= $2::timestamptz)
       AND ($3::timestamptz IS NULL OR s.ends_at < $3::timestamptz)

     ORDER BY "dueAt" DESC NULLS LAST, "sessionStartsAt" DESC
     LIMIT 100`,
    [studioId, range?.start ?? null, range?.end ?? null],
  );

  // 3. Đơn đã cọc / đã nhận, đang chuẩn bị hoàn thành buổi học để chốt quyết toán
  const upcomingQuery = await query<{
    bookingId: string;
    orderCode: string;
    workshopTitle: string;
    sessionStartsAt: Date;
    sessionEndsAt: Date | null;
    totalAmount: number;
    depositAmount: number;
    paidAmount: number;
    balanceAmount: number;
    paymentMode: string;
    reservationStatus: string;
    paymentStatus: string;
    isCompleted: boolean;
  }>(
    `SELECT b.id AS "bookingId", b.order_code::text AS "orderCode",
       w.title AS "workshopTitle", s.starts_at AS "sessionStartsAt", s.ends_at AS "sessionEndsAt",
       b.total_amount AS "totalAmount", b.deposit_amount AS "depositAmount",
       b.paid_amount AS "paidAmount", b.total_amount - b.paid_amount AS "balanceAmount",
       b.payment_mode AS "paymentMode", b.reservation_status AS "reservationStatus",
       b.status AS "paymentStatus",
       s.ends_at <= clock_timestamp() AS "isCompleted"
     FROM bookings b
     JOIN sessions s ON s.id = b.session_id
     JOIN workshops w ON w.id = s.workshop_id
     WHERE w.studio_id = $1
       AND b.reservation_status IN ('confirmed', 'completed')
       AND s.ends_at > clock_timestamp()
     ORDER BY s.starts_at ASC, b.created_at DESC
     LIMIT 100`,
    [studioId],
  );

  // 4. Tính toán tổng hợp trực tiếp bằng SQL trên toàn bộ dữ liệu (không giới hạn bởi LIMIT 100)
  const payoutSummaryQuery = await query<{
    totalPaidOut: string;
    pendingPayout: string;
  }>(
    `SELECT
       COALESCE(SUM(o.amount) FILTER (WHERE o.status = 'paid'), 0)::text AS "totalPaidOut",
       (
         COALESCE(SUM(o.amount) FILTER (WHERE o.status IN ('awaiting_approval', 'approved', 'processing')), 0)
         +
         COALESCE((
           SELECT SUM(
             GREATEST(
               0,
               COALESCE(
                 (SELECT sum(p2.amount) FROM payments p2 WHERE p2.booking_id = b2.id AND p2.kind = 'deposit' AND p2.status = 'paid'),
                 b2.deposit_amount,
                 0
               ) - b2.refund_due_amount - b2.extra_refund_due_amount
             )
           )
           FROM bookings b2
           JOIN sessions s2 ON s2.id = b2.session_id
           JOIN workshops w2 ON w2.id = s2.workshop_id
           WHERE w2.studio_id = $1
             AND b2.reservation_status IN ('confirmed', 'completed')
             AND s2.ends_at <= clock_timestamp()
             AND b2.payment_mode = 'payos_deposit'
             AND b2.paid_amount >= b2.deposit_amount
             AND NOT EXISTS (
               SELECT 1 FROM financial_obligations fo
               WHERE fo.booking_id = b2.id AND fo.kind = 'studio_payout' AND fo.status <> 'cancelled'
             )
             AND ($2::timestamptz IS NULL OR s2.ends_at >= $2::timestamptz)
             AND ($3::timestamptz IS NULL OR s2.ends_at < $3::timestamptz)
         ), 0)
       )::text AS "pendingPayout"
     FROM financial_obligations o
     JOIN bookings b ON b.id = o.booking_id
     JOIN sessions s ON s.id = b.session_id
     WHERE o.studio_id = $1
       AND o.kind = 'studio_payout'
       AND o.status <> 'cancelled'
       AND ($2::timestamptz IS NULL OR COALESCE(s.ends_at, o.created_at) >= $2::timestamptz)
       AND ($3::timestamptz IS NULL OR COALESCE(s.ends_at, o.created_at) < $3::timestamptz)`,
    [studioId, range?.start ?? null, range?.end ?? null],
  );

  const bookingSummaryQuery = await query<{
    directCollected: string;
    estimatedUpcoming: string;
  }>(
    `SELECT
       COALESCE(
         SUM(
           COALESCE(
             (
               SELECT SUM(p.amount)
               FROM payments p
               WHERE p.booking_id = b.id
                 AND p.status = 'paid'
                 AND p.kind IN ('balance', 'in_studio')
             ),
             CASE
               WHEN b.payment_mode = 'in_studio' THEN b.total_amount
               ELSE GREATEST(0, b.total_amount - b.deposit_amount)
             END
           )
         )
         FILTER (
           WHERE s.ends_at <= clock_timestamp()
             AND ($2::timestamptz IS NULL OR s.ends_at >= $2::timestamptz)
             AND ($3::timestamptz IS NULL OR s.ends_at < $3::timestamptz)
         ),
         0
       )::text AS "directCollected",
       COALESCE(
         SUM(b.deposit_amount)
         FILTER (
           WHERE s.ends_at > clock_timestamp()
             AND b.payment_mode = 'payos_deposit'
             AND b.paid_amount >= b.deposit_amount
         ),
         0
       )::text AS "estimatedUpcoming"
     FROM bookings b
     JOIN sessions s ON s.id = b.session_id
     JOIN workshops w ON w.id = s.workshop_id
     WHERE w.studio_id = $1
       AND b.reservation_status IN ('confirmed', 'completed')`,
    [studioId, range?.start ?? null, range?.end ?? null],
  );

  const totalPaidOut = Number(payoutSummaryQuery.rows[0]?.totalPaidOut ?? 0);
  const pendingPayout = Number(payoutSummaryQuery.rows[0]?.pendingPayout ?? 0);
  const directCollected = Number(
    bookingSummaryQuery.rows[0]?.directCollected ?? 0,
  );
  const estimatedUpcoming = Number(
    bookingSummaryQuery.rows[0]?.estimatedUpcoming ?? 0,
  );
  const totalEarned = totalPaidOut + pendingPayout + directCollected;

  res.setHeader('Cache-Control', 'no-store');
  res.json({
    period,
    summary: {
      totalEarned,
      totalPaidOut,
      pendingPayout,
      estimatedUpcoming,
      directCollected,
    },
    currentAccount,
    settlements: settlementsQuery.rows.map((s) => ({
      id: s.id,
      bookingId: s.bookingId,
      orderCode: s.orderCode,
      workshopTitle: s.workshopTitle,
      sessionStartsAt: s.sessionStartsAt.toISOString(),
      sessionEndsAt: s.sessionEndsAt ? s.sessionEndsAt.toISOString() : null,
      amount: Number(s.amount),
      collectedDeposit: Number(s.collectedDeposit),
      directAmount: Number(s.directAmount),
      isDirectPaid: Boolean(s.isDirectPaid),
      refundsRecorded: Number(s.refundsRecorded),
      feesRecorded: Number(s.feesRecorded),
      dueAt: s.dueAt ? s.dueAt.toISOString() : null,
      status: s.status,
      transfers: s.transfers,
    })),
    upcomingBookings: upcomingQuery.rows.map((b) => ({
      bookingId: b.bookingId,
      orderCode: b.orderCode,
      workshopTitle: b.workshopTitle,
      sessionStartsAt: b.sessionStartsAt.toISOString(),
      sessionEndsAt: b.sessionEndsAt ? b.sessionEndsAt.toISOString() : null,
      totalAmount: b.totalAmount,
      depositAmount: b.depositAmount,
      paidAmount: b.paidAmount,
      balanceAmount: b.balanceAmount,
      paymentMode: b.paymentMode,
      isCompleted: b.isCompleted,
    })),
  });
});
