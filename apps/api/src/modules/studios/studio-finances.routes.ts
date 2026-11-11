import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { validateUuidParam } from '../../middleware/validate-uuid-param.js';
import { query } from '../../db/pool.js';
import { AppError } from '../../errors/app-error.js';

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
       COALESCE((SELECT sum(p.amount) FROM payments p WHERE p.booking_id=b.id AND p.kind='deposit' AND p.status='paid'),0)::text AS "collectedDeposit",
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
     WHERE o.studio_id = $1 AND o.kind = 'studio_payout' AND o.status <> 'cancelled'
     GROUP BY o.id, b.id, w.id, s.id
     ORDER BY o.created_at DESC, o.due_at DESC
     LIMIT 100`,
    [studioId],
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
       AND NOT EXISTS (
         SELECT 1 FROM financial_obligations fo
         WHERE fo.booking_id = b.id AND fo.kind = 'studio_payout' AND fo.status <> 'cancelled'
       )
     ORDER BY s.starts_at ASC, b.created_at DESC
     LIMIT 100`,
    [studioId],
  );

  // 4. Tính toán tổng hợp
  let totalPaidOut = 0;
  let pendingPayout = 0;
  for (const s of settlementsQuery.rows) {
    const amt = Number(s.amount);
    if (s.status === 'paid') {
      totalPaidOut += amt;
    } else if (
      ['awaiting_approval', 'approved', 'processing'].includes(s.status)
    ) {
      pendingPayout += amt;
    }
  }

  let estimatedUpcoming = 0;
  let directCollected = 0;
  for (const b of upcomingQuery.rows) {
    if (b.paymentMode === 'payos_deposit' && b.paidAmount >= b.depositAmount) {
      estimatedUpcoming += b.depositAmount;
    }
    if (b.isCompleted) {
      directCollected += Math.max(0, b.balanceAmount);
    }
  }

  res.setHeader('Cache-Control', 'no-store');
  res.json({
    summary: {
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
