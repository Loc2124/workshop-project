import { withTransaction } from '../../db/pool.js';

const LOCK_NAMESPACE = 731904;
const LOCK_ID = 57;

/** Materialize ticket and excess-payment refunds into separate customer and
 * studio-funding obligations. The unique source keys make repeated scans safe.
 */
export async function syncRefundObligations() {
  return withTransaction(async (client) => {
    const lock = await client.query<{ acquired: boolean }>(
      'SELECT pg_try_advisory_xact_lock($1,$2) AS acquired',
      [LOCK_NAMESPACE, LOCK_ID],
    );
    if (!lock.rows[0]?.acquired) return 0;
    const sources = await client.query<{
      bookingId: string;
      studioId: string;
      ticketId: string | null;
      sourceKey: string;
      kind: 'ticket' | 'extra';
      originalDue: string;
      legacySettled: string;
      eventAt: Date;
      collectedDeposit: string;
      totalRefundDue: string;
      hasSettlementSnapshot: boolean;
      existingId: string | null;
      existingAmount: string | null;
      existingStatus: string | null;
      existingRelatedId: string | null;
      settledOutbound: string;
    }>(
      `SELECT b.id AS "bookingId",w.studio_id AS "studioId",t.id AS "ticketId",
         'ticket:'||t.id::text AS "sourceKey",'ticket'::text AS kind,
         t.refund_due_amount::text AS "originalDue",t.refunded_amount::text AS "legacySettled",
         COALESCE(t.refund_started_at,b.cancelled_at,b.created_at) AS "eventAt",
         COALESCE((SELECT sum(p.amount) FROM payments p WHERE p.booking_id=b.id AND p.kind='deposit' AND p.status='paid'),0)::text AS "collectedDeposit",
         (b.refund_due_amount+b.extra_refund_due_amount)::text AS "totalRefundDue",
         EXISTS(SELECT 1 FROM studio_settlement_snapshots snap WHERE snap.booking_id=b.id) AS "hasSettlementSnapshot",
         o.id AS "existingId",o.amount::text AS "existingAmount",o.status AS "existingStatus",
         o.related_obligation_id AS "existingRelatedId",
         COALESCE((SELECT sum(ft.amount) FROM financial_transfers ft WHERE ft.obligation_id=o.id AND ft.direction='outbound' AND ft.purpose IN ('customer_refund','platform_advance') AND ft.status='succeeded'),0)::text AS "settledOutbound"
       FROM tickets t JOIN bookings b ON b.id=t.booking_id JOIN sessions s ON s.id=b.session_id
       JOIN workshops w ON w.id=s.workshop_id
       LEFT JOIN financial_obligations o ON o.kind='customer_refund' AND o.source_key='ticket:'||t.id::text
       WHERE (t.refund_due_amount>t.refunded_amount AND (o.id IS NULL OR o.status NOT IN ('paid','cancelled') OR o.amount<t.refund_due_amount))
          OR (o.id IS NOT NULL AND o.status NOT IN ('paid','cancelled','manual_review'))
       UNION ALL
       SELECT b.id,w.studio_id,NULL::uuid,'extra:'||x.id::text,'extra'::text,
         x.amount::text,x.refunded_amount::text,x.created_at,
         COALESCE((SELECT sum(p.amount) FROM payments p WHERE p.booking_id=b.id AND p.kind='deposit' AND p.status='paid'),0)::text AS "collectedDeposit",
         (b.refund_due_amount+b.extra_refund_due_amount)::text AS "totalRefundDue",
         EXISTS(SELECT 1 FROM studio_settlement_snapshots snap WHERE snap.booking_id=b.id) AS "hasSettlementSnapshot",
         o.id AS "existingId",o.amount::text AS "existingAmount",o.status AS "existingStatus",
         o.related_obligation_id AS "existingRelatedId",
         COALESCE((SELECT sum(ft.amount) FROM financial_transfers ft WHERE ft.obligation_id=o.id AND ft.direction='outbound' AND ft.purpose IN ('customer_refund','platform_advance') AND ft.status='succeeded'),0)::text AS "settledOutbound"
       FROM booking_extra_refunds x JOIN bookings b ON b.id=x.booking_id
       JOIN sessions s ON s.id=b.session_id JOIN workshops w ON w.id=s.workshop_id
       LEFT JOIN financial_obligations o ON o.kind='customer_refund' AND o.source_key='extra:'||x.id::text
       WHERE (x.amount>x.refunded_amount AND (o.id IS NULL OR o.status NOT IN ('paid','cancelled') OR o.amount<x.amount))
          OR (o.id IS NOT NULL AND o.status NOT IN ('paid','cancelled','manual_review'))
       ORDER BY 1,4`,
    );
    for (const source of sources.rows) {
      const outstanding =
        BigInt(source.originalDue) - BigInt(source.legacySettled);
      const precalcTarget = outstanding + BigInt(source.settledOutbound);
      const coveredByPlatformDeposit =
        !source.hasSettlementSnapshot &&
        BigInt(source.collectedDeposit) > 0n &&
        BigInt(source.totalRefundDue) <= BigInt(source.collectedDeposit);
      if (
        source.existingId &&
        precalcTarget > 0n &&
        BigInt(source.existingAmount ?? '0') === precalcTarget &&
        (coveredByPlatformDeposit
          ? source.existingStatus !== 'awaiting_funds' &&
            !source.existingRelatedId
          : Boolean(source.existingRelatedId))
      ) {
        continue;
      }
      const refundKey = source.sourceKey;
      const prior = await client.query<{
        id: string;
        amount: string;
        status: string;
        relatedId: string | null;
      }>(
        `SELECT id,amount::text,status,related_obligation_id AS "relatedId" FROM financial_obligations WHERE kind='customer_refund' AND source_key=$1 FOR UPDATE`,
        [refundKey],
      );
      if (outstanding <= 0n && !prior.rows[0]) continue;
      const refundSettled = await client.query<{ amount: string }>(
        `SELECT COALESCE(sum(amount),0)::text AS amount FROM financial_transfers WHERE obligation_id=$1 AND direction='outbound' AND purpose IN ('customer_refund','platform_advance') AND status='succeeded'`,
        [prior.rows[0]?.id ?? null],
      );
      const targetTotal = outstanding + BigInt(refundSettled.rows[0]!.amount);
      if (targetTotal <= 0n) {
        await client.query(
          `UPDATE financial_obligations o SET status=CASE WHEN EXISTS(SELECT 1 FROM financial_transfers t WHERE t.obligation_id=o.id) THEN 'manual_review' ELSE 'cancelled' END,updated_at=clock_timestamp()
           WHERE (o.kind='customer_refund' AND o.source_key=$1) OR (o.kind='studio_recovery' AND o.source_key=$2)`,
          [source.sourceKey, `funding:${source.sourceKey}`],
        );
        continue;
      }
      const initialRefundStatus = coveredByPlatformDeposit
        ? 'awaiting_approval'
        : 'awaiting_funds';
      const refund = await client.query<{ id: string }>(
        `INSERT INTO financial_obligations(booking_id,studio_id,ticket_id,kind,source_key,amount,due_at,status,reason)
         VALUES($1,$2,$3,'customer_refund',$4,$5,financial_obligation_deadline('customer_refund',$6),$7,$8)
         ON CONFLICT(kind,source_key) DO UPDATE SET
           amount=GREATEST(financial_obligations.amount,EXCLUDED.amount),
           status=CASE WHEN EXCLUDED.amount<financial_obligations.amount THEN 'manual_review'
                       WHEN EXCLUDED.amount>financial_obligations.amount THEN EXCLUDED.status
                       WHEN financial_obligations.status='awaiting_funds' AND EXCLUDED.status='awaiting_approval' THEN 'awaiting_approval'
                       ELSE financial_obligations.status END,
           due_at=LEAST(financial_obligations.due_at,EXCLUDED.due_at),updated_at=clock_timestamp()
         RETURNING id`,
        [
          source.bookingId,
          source.studioId,
          source.ticketId,
          source.sourceKey,
          targetTotal.toString(),
          source.eventAt,
          initialRefundStatus,
          source.kind === 'ticket'
            ? 'Hoàn tiền theo vé'
            : 'Hoàn khoản thu thừa',
        ],
      );
      const refundId = refund.rows[0]!.id;
      if (coveredByPlatformDeposit) {
        if (prior.rows[0]?.relatedId) {
          await client.query(
            `UPDATE financial_obligations o
             SET status='cancelled',updated_at=clock_timestamp()
             WHERE o.id=$1 AND o.kind='studio_recovery'
               AND o.status NOT IN ('paid','cancelled')
               AND NOT EXISTS(SELECT 1 FROM financial_transfers t WHERE t.obligation_id=o.id AND t.status<>'failed')`,
            [prior.rows[0].relatedId],
          );
          await client.query(
            `UPDATE financial_obligations SET related_obligation_id=NULL,updated_at=clock_timestamp()
             WHERE id=$1 AND related_obligation_id=$2
               AND EXISTS(SELECT 1 FROM financial_obligations r WHERE r.id=$2 AND r.status='cancelled')`,
            [refundId, prior.rows[0].relatedId],
          );
        }
      } else {
        const recovery = await client.query<{ id: string }>(
          `INSERT INTO financial_obligations(booking_id,studio_id,ticket_id,kind,source_key,amount,due_at,status,reason,related_obligation_id)
           VALUES($1,$2,$3,'studio_recovery',$4,$5,financial_obligation_deadline('customer_refund',$6),'awaiting_funds',$7,$8)
           ON CONFLICT(kind,source_key) DO UPDATE SET
             amount=GREATEST(financial_obligations.amount,EXCLUDED.amount),
             status=CASE WHEN EXCLUDED.amount<financial_obligations.amount THEN 'manual_review'
                         WHEN EXCLUDED.amount>financial_obligations.amount THEN 'awaiting_funds'
                         ELSE financial_obligations.status END,
             due_at=LEAST(financial_obligations.due_at,EXCLUDED.due_at),updated_at=clock_timestamp()
           RETURNING id`,
          [
            source.bookingId,
            source.studioId,
            source.ticketId,
            `funding:${source.sourceKey}`,
            targetTotal.toString(),
            source.eventAt,
            'Studio hoàn tiền về Open Slot trước khi nền tảng chuyển cho khách',
            refundId,
          ],
        );
        await client.query(
          `UPDATE financial_obligations SET related_obligation_id=$2,updated_at=clock_timestamp()
           WHERE id=$1 AND related_obligation_id IS DISTINCT FROM $2`,
          [refundId, recovery.rows[0]!.id],
        );
      }
    }
    await client.query(
      `INSERT INTO user_notifications(user_id,booking_id,type,title,body,href)
       SELECT DISTINCT b.user_id,b.id,'refund_account_required','Bổ sung tài khoản nhận hoàn',
         'Vui lòng nhập tài khoản để Open Slot đối chiếu và hoàn tiền đúng hạn.',
         '/me/bookings/'||b.id::text||'?refund='||o.id::text
       FROM financial_obligations o JOIN bookings b ON b.id=o.booking_id
       WHERE o.kind='customer_refund' AND o.status NOT IN ('paid','cancelled')
         AND NOT EXISTS(SELECT 1 FROM customer_refund_accounts a WHERE a.refund_id=o.id AND a.is_current AND a.status IN ('pending','verified') AND a.purged_at IS NULL)
         AND NOT EXISTS(SELECT 1 FROM user_notifications n WHERE n.type='refund_account_required'
           AND n.href='/me/bookings/'||b.id::text||'?refund='||o.id::text)`,
    );
    const payouts = await client.query<{
      sessionId: string;
      studioId: string;
      bookingId: string;
      dueAt: Date;
      net: string;
      fees: string;
      available: string;
      collected: string;
      refunds: string;
    }>(
      `WITH per_booking AS (
         SELECT b.id AS booking_id,b.session_id,
           COALESCE(
             sum(p.amount) FILTER(WHERE p.status='paid' AND p.kind='deposit'),
             CASE WHEN b.payment_mode = 'payos_deposit' THEN b.deposit_amount ELSE 0 END
           )::bigint AS collected,
           COALESCE((SELECT sum(f.amount) FROM payments paid JOIN payment_fee_reconciliations f ON f.payment_id=paid.id WHERE paid.booking_id=b.id AND paid.status='paid' AND paid.kind='deposit'),0)
             +COALESCE((SELECT sum(t.provider_fee) FROM financial_transfers t JOIN financial_obligations fo ON fo.id=t.obligation_id WHERE fo.booking_id=b.id AND t.direction='outbound' AND t.purpose IN ('customer_refund','platform_advance','studio_payout') AND t.status='succeeded'),0)::bigint AS provider_fees,
           b.refund_due_amount+b.extra_refund_due_amount AS refunds_recorded,
           w.studio_id,financial_obligation_deadline('studio_payout',s.ends_at) AS due_at
         FROM bookings b JOIN sessions s ON s.id=b.session_id
         JOIN workshops w ON w.id=s.workshop_id LEFT JOIN payments p ON p.booking_id=b.id
         WHERE s.ends_at<=clock_timestamp()
           AND b.reservation_status IN ('confirmed', 'completed')
           AND (
             NOT EXISTS(SELECT 1 FROM studio_settlement_snapshots snap WHERE snap.booking_id=b.id)
             OR NOT EXISTS(SELECT 1 FROM financial_obligations fo WHERE fo.booking_id=b.id AND fo.kind='studio_payout' AND fo.status<>'cancelled')
           )
         GROUP BY b.id,b.session_id,w.studio_id,s.ends_at,b.deposit_amount,b.payment_mode
       )
       SELECT session_id AS "sessionId",studio_id AS "studioId",booking_id AS "bookingId",due_at AS "dueAt",
         (collected-refunds_recorded-provider_fees)::text AS net,
         provider_fees::text AS fees,GREATEST(0,collected-refunds_recorded)::text AS available,
         collected::text AS collected,refunds_recorded::text AS refunds
       FROM per_booking p
       ORDER BY due_at,session_id,booking_id`,
    );
    for (const payout of payouts.rows) {
      const net = BigInt(payout.net);
      const breakdown = JSON.stringify({
        sessionId: payout.sessionId,
        collected: payout.collected,
        refundsRecorded: payout.refunds,
        providerFees: payout.fees,
        payout: net.toString(),
      });
      await client.query(
        `INSERT INTO studio_settlement_snapshots(booking_id,session_id,due_at,net_amount,breakdown)
         VALUES($1,$2,$3,$4,$5::jsonb)
         ON CONFLICT(booking_id) DO UPDATE SET
           due_at=EXCLUDED.due_at,
           net_amount=EXCLUDED.net_amount,
           breakdown=EXCLUDED.breakdown`,
        [
          payout.bookingId,
          payout.sessionId,
          payout.dueAt,
          net.toString(),
          breakdown,
        ],
      );
      if (net > 0n) {
        await client.query(
          `INSERT INTO financial_obligations(booking_id,studio_id,kind,source_key,amount,due_at,status,reason,payout_snapshot_at,payout_snapshot)
           VALUES($1,$2,'studio_payout',$3,$4,$5,'awaiting_approval','Khoản chi studio sau khi trừ khoản hoàn đã ghi nhận và phí thực tế của chính buổi học tại thời điểm chốt.',clock_timestamp(),$6::jsonb)
           ON CONFLICT(kind,source_key) DO UPDATE SET
             amount=EXCLUDED.amount,
             due_at=EXCLUDED.due_at,
             payout_snapshot=EXCLUDED.payout_snapshot,
             payout_snapshot_at=clock_timestamp()
           WHERE financial_obligations.status IN ('awaiting_approval','awaiting_funds')`,
          [
            payout.bookingId,
            payout.studioId,
            `session:${payout.sessionId}:booking:${payout.bookingId}`,
            net.toString(),
            payout.dueAt,
            breakdown,
          ],
        );
        const formattedNet = Number(net).toLocaleString('vi-VN');
        await client.query(
          `INSERT INTO user_notifications(user_id,booking_id,type,title,body,href)
           SELECT sm.user_id,$1::uuid,'studio_payout_pending',
             'Khoản tiền quyết toán sẵn sàng',
             'Buổi học đã hoàn thành. Khoản tiền cọc '||$2||' đ đã được lên lịch quyết toán. Vui lòng kiểm tra mục Quyết toán.',
             '/studio/'||$3::uuid::text||'/finances'
           FROM studio_members sm
           WHERE sm.studio_id=$3::uuid AND sm.role='owner'
             AND NOT EXISTS(SELECT 1 FROM user_notifications n WHERE n.user_id=sm.user_id AND n.booking_id=$1::uuid AND n.type='studio_payout_pending')`,
          [payout.bookingId, formattedNet, payout.studioId],
        );
      }
      const feeExcess = BigInt(payout.fees) - BigInt(payout.available);
      if (feeExcess > 0n)
        await client.query(
          `INSERT INTO financial_obligations(booking_id,studio_id,kind,source_key,amount,due_at,status,reason)
         VALUES($1,$2,'studio_recovery',$3,$4,NULL,'awaiting_funds','Phí thực tế của chính buổi học vượt khoản chi còn lại; studio cần chuyển bù phần chênh lệch.')
         ON CONFLICT(kind,source_key) DO NOTHING`,
          [
            payout.bookingId,
            payout.studioId,
            `fee:session:${payout.sessionId}:booking:${payout.bookingId}`,
            feeExcess.toString(),
          ],
        );
    }
    await client.query(
      `WITH candidates AS (
         SELECT o.id,o.booking_id,o.kind,o.due_at,
           CASE WHEN o.due_at<clock_timestamp() THEN 'overdue' ELSE 'due_soon' END AS stage
         FROM financial_obligations o
         WHERE o.due_at IS NOT NULL AND o.due_at<=clock_timestamp()+interval '24 hours'
           AND o.status NOT IN ('paid','cancelled')
           AND EXISTS(SELECT 1 FROM users WHERE role='admin')
       ), inserted AS (
         INSERT INTO financial_due_alerts(obligation_id,stage)
         SELECT id,stage FROM candidates ON CONFLICT DO NOTHING
         RETURNING obligation_id,stage
       )
       INSERT INTO user_notifications(user_id,booking_id,type,title,body,href)
       SELECT u.id,c.booking_id,'financial_due',
         CASE WHEN i.stage='overdue' THEN 'Khoản tài chính đã quá hạn' ELSE 'Khoản tài chính sắp đến hạn' END,
         CASE c.kind WHEN 'customer_refund' THEN 'Cần xử lý khoản hoàn cho khách.'
                     WHEN 'studio_payout' THEN 'Cần xử lý khoản chi cho studio.'
                     ELSE 'Cần xử lý khoản studio chuyển về Open Slot.' END,
         '/admin/tai-chinh'
       FROM inserted i JOIN candidates c ON c.id=i.obligation_id AND c.stage=i.stage
       CROSS JOIN users u WHERE u.role='admin'`,
    );
    await client.query(
      `UPDATE customer_refund_accounts a
       SET encrypted_number=NULL,encryption_iv=NULL,encryption_tag=NULL,
           bank_name=NULL,bank_bin=NULL,account_holder=NULL,
           is_current=false,purged_at=clock_timestamp()
       FROM financial_obligations o
       WHERE a.refund_id=o.id AND a.purged_at IS NULL AND o.kind='customer_refund'
         AND o.status='paid'
         AND NOT EXISTS(SELECT 1 FROM financial_transfers pending
           WHERE pending.destination_customer_account_id=a.id
             AND pending.status NOT IN ('succeeded','failed'))
         AND (SELECT max(t.settled_at) FROM financial_transfers t
              WHERE t.obligation_id=o.id AND t.direction='outbound' AND t.status='succeeded')
             <=clock_timestamp()-interval '7 days'`,
    );
    await client.query(
      `UPDATE customer_refund_accounts a
       SET encrypted_number=NULL,encryption_iv=NULL,encryption_tag=NULL,
           bank_name=NULL,bank_bin=NULL,account_holder=NULL,
           is_current=false,purged_at=clock_timestamp()
       WHERE a.refund_id IS NULL AND a.purged_at IS NULL AND NOT EXISTS (
         SELECT 1 FROM financial_transfers t WHERE t.destination_customer_account_id=a.id
           AND t.status NOT IN ('succeeded','failed'))
         AND (NOT EXISTS (SELECT 1 FROM financial_transfers t WHERE t.destination_customer_account_id=a.id)
           OR (SELECT max(t.settled_at) FROM financial_transfers t
                 WHERE t.destination_customer_account_id=a.id AND t.status='succeeded')
              <=clock_timestamp()-interval '7 days')`,
    );
    return sources.rowCount ?? 0;
  });
}

export function startFinancialObligationJob() {
  let running = false;
  const run = async () => {
    if (running) return;
    running = true;
    try {
      await syncRefundObligations();
    } catch (error) {
      console.error('Financial obligation sync failed.', error);
    } finally {
      running = false;
    }
  };
  void run();
  const timer = setInterval(() => void run(), 5 * 60_000);
  timer.unref();
  return () => clearInterval(timer);
}
