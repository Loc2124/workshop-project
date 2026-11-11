import type { PoolClient } from 'pg';
import { getPool, withTransaction } from '../../db/pool.js';
import { loadConfig } from '../../config.js';
import { AppError } from '../../errors/app-error.js';
import { decryptFinancialAccount } from './financial-account-crypto.js';
import { writeAuditLog } from '../admin/audit-log.js';
import { createPayoutProvider } from './providers/index.js';
import type { PayoutResult } from './providers/payout-provider.js';

export async function applySessionFee(
  client: PoolClient,
  bookingId: string,
  studioId: string,
  fee: number,
  sourceKey: string,
  reason: string,
  deferUntilPayout = false,
) {
  if (fee <= 0) return;
  const payout = await client.query<{
    id: string | null;
    amount: string | null;
    status: string | null;
    sessionId: string;
  }>(
    `SELECT o.id,o.amount::text,o.status,b.session_id AS "sessionId"
     FROM bookings b LEFT JOIN financial_obligations o ON o.booking_id=b.id AND o.kind='studio_payout'
     WHERE b.id=$1 FOR UPDATE OF b`,
    [bookingId],
  );
  const row = payout.rows[0];
  if (!row) return;
  if (!row.id && deferUntilPayout) {
    const snapshot = await client.query(
      `SELECT 1 FROM studio_settlement_snapshots WHERE booking_id=$1`,
      [bookingId],
    );
    if (!snapshot.rowCount) return;
  }
  let unapplied = BigInt(fee);
  if (
    row.id &&
    row.amount &&
    row.status !== 'paid' &&
    row.status !== 'cancelled'
  ) {
    const committed = await client.query<{ amount: string }>(
      `SELECT COALESCE(sum(amount),0)::text AS amount FROM financial_transfers WHERE obligation_id=$1 AND direction='outbound' AND status<>'failed'`,
      [row.id],
    );
    const available = BigInt(row.amount) - BigInt(committed.rows[0]!.amount);
    const offset =
      available > 0n ? (unapplied < available ? unapplied : available) : 0n;
    if (offset > 0n) {
      const revised = BigInt(row.amount) - offset;
      if (revised > 0n)
        await client.query(
          `UPDATE financial_obligations SET amount=$2,reason=reason||' Phí nhà cung cấp của cùng buổi đã được trừ.',updated_at=clock_timestamp() WHERE id=$1`,
          [row.id, revised.toString()],
        );
      else
        await client.query(
          `UPDATE financial_obligations SET status='cancelled',reason=reason||' Khoản chi được bù hết bằng phí thực tế của cùng buổi.',updated_at=clock_timestamp() WHERE id=$1`,
          [row.id],
        );
      unapplied -= offset;
    }
  }
  if (unapplied > 0n)
    await client.query(
      `INSERT INTO financial_obligations(booking_id,studio_id,kind,source_key,amount,due_at,status,reason)
     VALUES($1,$2,'studio_recovery',$3,$4,NULL,'awaiting_funds',$5) ON CONFLICT(kind,source_key) DO NOTHING`,
      [bookingId, studioId, sourceKey, unapplied.toString(), reason],
    );
}

export async function processTransferResult(
  client: PoolClient,
  transferId: string,
  actorId: string,
  input: {
    result: 'succeeded' | 'failed' | 'manual_review';
    reference?: string;
    provider?: string;
    providerFee?: number;
    reason: string;
  },
  refundNoticeRef?: {
    value?: { bookingId: string; amount: string; reference?: string };
  },
) {
  const result = await client.query<{
    bookingId: string;
    studioId: string;
    obligationId: string;
    relatedId: string | null;
    kind: string;
    direction: string;
    purpose: string;
    amount: string;
    providerFee: string | null;
    sourceKey: string;
    userId: string;
  }>(
    `UPDATE financial_transfers t SET status=$2,reference=COALESCE($3,t.reference),provider=COALESCE($4,t.provider),provider_fee=COALESCE($5,t.provider_fee),settled_at=CASE WHEN $2='succeeded' THEN clock_timestamp() ELSE NULL END,failure_reason=CASE WHEN $2='succeeded' THEN NULL ELSE $6 END
   FROM financial_obligations o WHERE t.id=$1 AND t.obligation_id=o.id AND t.status IN ('recorded','approved','processing','pending_approval','manual_review')
   AND t.approved_by IS NOT NULL
   AND ($2<>'succeeded' OR t.purpose<>'studio_payout' OR EXISTS(
     SELECT 1 FROM studio_payout_accounts a WHERE a.id=t.destination_studio_account_id AND a.is_current AND a.status='verified'))
   AND ($2<>'succeeded' OR t.purpose NOT IN ('customer_refund','platform_advance') OR EXISTS(
     SELECT 1 FROM customer_refund_accounts a WHERE a.id=t.destination_customer_account_id
       AND a.refund_id=o.id AND a.is_current AND a.status='verified' AND a.purged_at IS NULL))
   RETURNING o.booking_id AS "bookingId",o.studio_id AS "studioId",o.id AS "obligationId",o.related_obligation_id AS "relatedId",o.kind,o.source_key AS "sourceKey",t.direction,t.purpose,t.amount::text,t.provider_fee::text AS "providerFee",(SELECT user_id FROM bookings WHERE id=o.booking_id) AS "userId"`,
    [
      transferId,
      input.result,
      input.reference ?? null,
      input.provider ?? null,
      input.providerFee ?? null,
      input.result === 'succeeded' ? null : input.reason,
    ],
  );
  const transfer = result.rows[0];
  if (!transfer)
    throw new AppError(
      409,
      'CONFLICT',
      'Không thể ghi nhận kết quả giao dịch này.',
    );
  if (
    input.result === 'succeeded' &&
    transfer.direction === 'outbound' &&
    ['customer_refund', 'platform_advance'].includes(transfer.purpose)
  ) {
    if (refundNoticeRef) {
      refundNoticeRef.value = {
        bookingId: transfer.bookingId,
        amount: transfer.amount,
        reference: input.reference,
      };
    }
  }
  await client.query(
    `INSERT INTO financial_transfer_events(transfer_id,actor_id,event,details) VALUES($1,$2,$3,$4::jsonb)`,
    [
      transferId,
      actorId,
      input.result === 'succeeded'
        ? 'succeeded'
        : input.result === 'failed'
          ? 'failed'
          : 'manual_review',
      JSON.stringify({
        reason: input.reason,
        reference: input.reference ?? null,
        provider: input.provider ?? null,
        providerFee: input.providerFee ?? null,
      }),
    ],
  );
  if (
    input.result === 'succeeded' &&
    transfer.direction === 'outbound' &&
    ['customer_refund', 'platform_advance'].includes(transfer.purpose)
  ) {
    if (input.reference && input.provider)
      await client.query(
        `INSERT INTO booking_refund_receipts(booking_id,amount,reference,actor_id,refunded_at) VALUES($1,$2,$3,$4,clock_timestamp())`,
        [transfer.bookingId, transfer.amount, input.reference, actorId],
      );
    if (transfer.sourceKey.startsWith('ticket:')) {
      const ticketId = transfer.sourceKey.slice('ticket:'.length);
      const changed = await client.query(
        `UPDATE tickets SET refunded_amount=LEAST(refund_due_amount,refunded_amount+$2) WHERE id=$1 AND booking_id=$3 RETURNING id`,
        [ticketId, transfer.amount, transfer.bookingId],
      );
      if (!changed.rowCount)
        throw new AppError(
          409,
          'CONFLICT',
          'Không tìm thấy vé gắn với khoản hoàn này.',
        );
      await client.query(
        `UPDATE bookings b SET refund_due_amount=x.due,refunded_amount=x.refunded,refund_status=CASE WHEN x.due+b.extra_refund_due_amount>x.refunded+b.extra_refunded_amount THEN 'pending' WHEN x.due+b.extra_refund_due_amount>0 THEN 'refunded' ELSE 'not_applicable' END,status=CASE WHEN b.reservation_status='cancelled' AND x.due+b.extra_refund_due_amount<=x.refunded+b.extra_refunded_amount THEN 'cancelled'::booking_status ELSE b.status END FROM (SELECT COALESCE(sum(refund_due_amount),0)::int due,COALESCE(sum(refunded_amount),0)::int refunded FROM booking_seats WHERE booking_id=$1) x WHERE b.id=$1`,
        [transfer.bookingId],
      );
    } else if (transfer.sourceKey.startsWith('extra:')) {
      const extraId = transfer.sourceKey.slice('extra:'.length);
      const changed = await client.query(
        `UPDATE booking_extra_refunds SET refunded_amount=LEAST(amount,refunded_amount+$2) WHERE id=$1 AND booking_id=$3 RETURNING id`,
        [extraId, transfer.amount, transfer.bookingId],
      );
      if (!changed.rowCount)
        throw new AppError(
          409,
          'CONFLICT',
          'Không tìm thấy khoản thu thừa gắn với yêu cầu hoàn.',
        );
      await client.query(
        `UPDATE bookings b SET extra_refunded_amount=x.refunded,refund_status=CASE WHEN b.refund_due_amount+b.extra_refund_due_amount>b.refunded_amount+x.refunded THEN 'pending' WHEN b.refund_due_amount+b.extra_refund_due_amount>0 THEN 'refunded' ELSE 'not_applicable' END,status=CASE WHEN b.reservation_status='cancelled' AND b.refund_due_amount+b.extra_refund_due_amount<=b.refunded_amount+x.refunded THEN 'cancelled'::booking_status ELSE b.status END FROM (SELECT COALESCE(sum(refunded_amount),0)::int refunded FROM booking_extra_refunds WHERE booking_id=$1) x WHERE b.id=$1`,
        [transfer.bookingId],
      );
    }
    await client.query(
      `INSERT INTO user_notifications(user_id,booking_id,type,title,body,href) VALUES($1::uuid,$2::uuid,'deposit_refunded','Đã chuyển khoản hoàn tiền',$3,'/me/bookings/'||$2::uuid::text)`,
      [
        transfer.userId,
        transfer.bookingId,
        `Khoản hoàn ${Number(transfer.amount).toLocaleString('vi-VN')} đ đã được chuyển. Mã đối chiếu: ${input.reference}.`,
      ],
    );
  }
  if (input.result === 'failed') {
    const remaining = await client.query<{
      amount: string;
      settled: string;
      reserved: string;
    }>(
      `SELECT o.amount::text,
       COALESCE(sum(t.amount) FILTER(WHERE t.status='succeeded'),0)::text AS settled,
       COALESCE(sum(t.amount) FILTER(WHERE t.status NOT IN ('succeeded','failed')),0)::text AS reserved
     FROM financial_obligations o LEFT JOIN financial_transfers t ON t.obligation_id=o.id
     WHERE o.id=$1 GROUP BY o.id`,
      [transfer.obligationId],
    );
    const totals = remaining.rows[0]!;
    await client.query(
      `UPDATE financial_obligations SET status=$2,updated_at=clock_timestamp() WHERE id=$1`,
      [
        transfer.obligationId,
        BigInt(totals.reserved) > 0n
          ? 'awaiting_approval'
          : BigInt(totals.settled) > 0n
            ? 'partially_paid'
            : 'failed',
      ],
    );
  }
  if (input.result === 'manual_review') {
    await client.query(
      `UPDATE financial_obligations SET status='manual_review',updated_at=clock_timestamp() WHERE id=$1`,
      [transfer.obligationId],
    );
  }
  if (input.result === 'succeeded') {
    const remaining = await client.query<{
      amount: string;
      settled: string;
    }>(
      `SELECT o.amount::text,COALESCE(sum(t.amount) FILTER(WHERE t.status='succeeded'),0)::text AS settled FROM financial_obligations o LEFT JOIN financial_transfers t ON t.obligation_id=o.id WHERE o.id=$1 GROUP BY o.id`,
      [transfer.obligationId],
    );
    const paid =
      BigInt(remaining.rows[0]!.settled) >= BigInt(remaining.rows[0]!.amount);
    await client.query(
      `UPDATE financial_obligations SET status=$2,updated_at=clock_timestamp() WHERE id=$1`,
      [transfer.obligationId, paid ? 'paid' : 'partially_paid'],
    );
    if (paid && transfer.kind === 'studio_recovery' && transfer.relatedId) {
      await client.query(
        `UPDATE financial_obligations SET status=CASE WHEN status IN ('awaiting_funds','partially_paid') THEN 'awaiting_approval' ELSE status END,updated_at=clock_timestamp() WHERE id=$1`,
        [transfer.relatedId],
      );
    }
    if (
      transfer.direction === 'outbound' &&
      input.providerFee &&
      input.providerFee > 0 &&
      ['customer_refund', 'platform_advance', 'studio_payout'].includes(
        transfer.purpose,
      )
    ) {
      await applySessionFee(
        client,
        transfer.bookingId,
        transfer.studioId,
        input.providerFee,
        `fee:transfer:${transferId}`,
        `Phí thực tế nhà cung cấp ${input.provider ?? 'payout'} cho giao dịch ${transfer.purpose}. Studio chịu khoản phí này.`,
        true,
      );
    }
  }
  await writeAuditLog(client, {
    actorId,
    action: `financial.transfer.${input.result}`,
    targetType: 'booking',
    targetId: transfer.bookingId,
    targetName: 'Kết quả giao dịch',
    reason: input.reason,
    after: {
      transferId,
      result: input.result,
      reference: input.reference ?? null,
    },
  });
}

export async function executeAutomatedPayoutTransfer(
  transferId: string,
  actorId: string,
  refundNoticeRef?: {
    value?: { bookingId: string; amount: string; reference?: string };
  },
): Promise<{
  status: 'succeeded' | 'failed' | 'manual_review' | 'processing';
  reference?: string;
  errorMessage?: string;
}> {
  const transferQuery = await getPool().query<{
    id: string;
    obligationId: string;
    bookingId: string;
    studioId: string;
    amount: string;
    purpose: string;
    status: string;
    destinationStudioAccountId: string | null;
    destinationCustomerAccountId: string | null;
  }>(
    `SELECT t.id, t.obligation_id AS "obligationId", o.booking_id AS "bookingId", o.studio_id AS "studioId",
            t.amount::text, t.purpose, t.status,
            t.destination_studio_account_id AS "destinationStudioAccountId",
            t.destination_customer_account_id AS "destinationCustomerAccountId"
     FROM financial_transfers t
     JOIN financial_obligations o ON o.id = t.obligation_id
     WHERE t.id = $1`,
    [transferId],
  );
  const transfer = transferQuery.rows[0];
  if (!transfer) {
    throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy giao dịch.');
  }

  let accountData: {
    bankBin: string | null;
    accountHolder: string;
    encryptedNumber: Buffer;
    iv: Buffer;
    tag: Buffer;
  } | null = null;

  if (transfer.purpose === 'studio_payout') {
    const acc = await getPool().query<{
      bankBin: string | null;
      accountHolder: string;
      encryptedNumber: Buffer;
      iv: Buffer;
      tag: Buffer;
    }>(
      `SELECT bank_bin AS "bankBin", account_holder AS "accountHolder",
              encrypted_number AS "encryptedNumber", encryption_iv AS "iv", encryption_tag AS "tag"
       FROM studio_payout_accounts WHERE id = $1`,
      [transfer.destinationStudioAccountId],
    );
    accountData = acc.rows[0] ?? null;
  } else if (
    ['customer_refund', 'platform_advance'].includes(transfer.purpose)
  ) {
    const acc = await getPool().query<{
      bankBin: string | null;
      accountHolder: string;
      encryptedNumber: Buffer;
      iv: Buffer;
      tag: Buffer;
    }>(
      `SELECT bank_bin AS "bankBin", account_holder AS "accountHolder",
              encrypted_number AS "encryptedNumber", encryption_iv AS "iv", encryption_tag AS "tag"
       FROM customer_refund_accounts WHERE id = $1`,
      [transfer.destinationCustomerAccountId],
    );
    accountData = acc.rows[0] ?? null;
  }

  if (!accountData) {
    throw new AppError(
      409,
      'CONFLICT',
      'Không tìm thấy tài khoản thụ hưởng của giao dịch.',
    );
  }

  if (!accountData.bankBin || accountData.bankBin.trim().length !== 6) {
    // Không có mã BIN 6 số để chuyển qua payOS, chuyển sang manual_review để admin chi thủ công
    await withTransaction(async (client: PoolClient) => {
      await processTransferResult(client, transferId, actorId, {
        result: 'manual_review',
        reason:
          'Tài khoản thụ hưởng chưa có mã BIN ngân hàng 6 chữ số. Cần chi thủ công.',
      });
    });
    return {
      status: 'manual_review',
      errorMessage: 'Tài khoản thụ hưởng thiếu mã BIN ngân hàng 6 chữ số.',
    };
  }

  const toAccountNumber = decryptFinancialAccount(
    accountData.encryptedNumber,
    accountData.iv,
    accountData.tag,
  );

  await getPool().query(
    `UPDATE financial_transfers SET status='processing' WHERE id=$1 AND status='approved'`,
    [transferId],
  );
  await getPool().query(
    `INSERT INTO financial_transfer_events(transfer_id,actor_id,event,details)
     VALUES($1,$2,'submitted','{"reason":"Đang chuyển lệnh chi tự động qua payOS"}'::jsonb)`,
    [transferId, actorId],
  );

  const provider = createPayoutProvider();
  let payoutResult: PayoutResult;

  try {
    payoutResult = await provider.executePayout({
      transferId,
      amount: Number(transfer.amount),
      toBin: accountData.bankBin.trim(),
      toAccountNumber,
      accountHolderName: accountData.accountHolder,
      description: `Chi tien ${transferId.slice(0, 8)}`,
    });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    await withTransaction(async (client: PoolClient) => {
      await processTransferResult(client, transferId, actorId, {
        result: 'manual_review',
        reason: `Lỗi kết nối khi gọi chi hộ: ${errMsg}. Cần kiểm tra lại trạng thái lệnh chi.`,
      });
    });
    return {
      status: 'manual_review',
      errorMessage: `Lỗi mạng khi kết nối cổng chi: ${errMsg}`,
    };
  }

  const currentProvider = loadConfig().PAYOUT_PROVIDER;
  await withTransaction(async (client: PoolClient) => {
    if (payoutResult.status === 'succeeded') {
      await processTransferResult(
        client,
        transferId,
        actorId,
        {
          result: 'succeeded',
          reference: payoutResult.reference,
          provider: currentProvider,
          providerFee: payoutResult.providerFee,
          reason: 'Chi hộ tự động qua payOS thành công',
        },
        refundNoticeRef,
      );
    } else if (payoutResult.status === 'failed') {
      await processTransferResult(client, transferId, actorId, {
        result: 'failed',
        reference: payoutResult.reference,
        provider: currentProvider,
        reason: payoutResult.failureReason || 'Lệnh chi payOS thất bại',
      });
    } else {
      await processTransferResult(client, transferId, actorId, {
        result: 'manual_review',
        reference: payoutResult.reference,
        provider: currentProvider,
        reason:
          payoutResult.failureReason ||
          'Lệnh chi payOS đang xử lý hoặc cần kiểm tra đối soát',
      });
    }
  });

  return {
    status: payoutResult.status,
    reference: payoutResult.reference,
    errorMessage: payoutResult.failureReason,
  };
}
