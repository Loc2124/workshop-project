import { Router } from 'express';
import { z } from 'zod';
import { formatBankDisplay } from '@workshop/shared';
import { withTransaction } from '../../../db/pool.js';
import { AppError } from '../../../errors/app-error.js';
import { writeAuditLog } from '../audit-log.js';
import { decryptFinancialAccount } from '../../payments/financial-account-crypto.js';
import { queueRefundEmail } from '../../../services/booking-emails.js';
import { processTransferResult } from '../../payments/transfer-execution.js';

export const obligationsRouter = Router();

const transferInput = z
  .object({
    amount: z.number().int().positive(),
    purpose: z
      .enum([
        'studio_repayment',
        'customer_refund',
        'studio_payout',
        'platform_advance',
      ])
      .optional(),
    reference: z.string().trim().min(3).max(200).optional(),
    provider: z.string().trim().min(2).max(80).optional(),
    idempotencyKey: z.string().trim().min(8).max(120),
    reason: z.string().trim().min(10).max(500),
  })
  .strict();

obligationsRouter.get('/nghia-vu', async (_req, res) => {
  const result = await withTransaction((client) =>
    client.query(
      `SELECT o.id,o.booking_id AS "bookingId",b.order_code::text AS "orderCode",
      o.studio_id AS "studioId",st.name AS "studioName",o.ticket_id AS "ticketId",
      o.kind,o.source_key AS "sourceKey",o.amount,o.due_at AS "dueAt",o.status,
      o.reason,o.created_at AS "createdAt",
      CASE WHEN o.due_at<clock_timestamp() THEN 'overdue'
           WHEN o.due_at<=clock_timestamp()+interval '1 day' THEN 'due_soon'
           ELSE NULL END AS "dueState",
      COALESCE(sum(t.amount) FILTER (WHERE t.status='succeeded'),0)::bigint AS "settledAmount",
      COALESCE(sum(t.amount) FILTER (WHERE t.status NOT IN ('succeeded','failed')),0)::bigint AS "reservedAmount",
      COALESCE(da.bank_bin,ca.bank_bin) AS "destinationBankBin",
      COALESCE(da.bank_name,ca.bank_name) AS "destinationBankName",
      COALESCE(da.account_holder,ca.account_holder) AS "destinationHolder",
      COALESCE(da.account_last4,ca.account_last4) AS "destinationLast4",
      COALESCE(da.status,ca.status) AS "destinationStatus"
     FROM financial_obligations o JOIN bookings b ON b.id=o.booking_id
     JOIN studios st ON st.id=o.studio_id
     LEFT JOIN financial_transfers t ON t.obligation_id=o.id
     LEFT JOIN studio_payout_accounts da ON o.kind='studio_payout' AND da.studio_id=o.studio_id AND da.is_current AND da.status IN ('pending','verified')
     LEFT JOIN customer_refund_accounts ca ON o.kind='customer_refund' AND ca.refund_id=o.id AND ca.is_current AND ca.status IN ('pending','verified') AND ca.purged_at IS NULL
     WHERE o.status NOT IN ('paid','cancelled')
     GROUP BY o.id,b.order_code,st.name,da.bank_bin,da.bank_name,da.account_holder,da.account_last4,da.status,ca.bank_bin,ca.bank_name,ca.account_holder,ca.account_last4,ca.status
     ORDER BY o.due_at NULLS LAST,o.created_at`,
    ),
  );
  res.json({ items: result.rows });
});

obligationsRouter.get('/doi-soat', async (_req, res) => {
  const result = await withTransaction((client) =>
    client.query(
      `SELECT snap.booking_id AS "bookingId",b.order_code::text AS "orderCode",
      st.name AS "studioName",w.title AS "workshopTitle",snap.session_id AS "sessionId",
      snap.due_at AS "dueAt",snap.created_at AS "closedAt",snap.net_amount AS "netAmount",
      snap.breakdown,o.id AS "payoutObligationId",o.amount AS "currentPayoutAmount",o.status AS "payoutStatus",
      (b.refund_due_amount+b.extra_refund_due_amount)::bigint AS "currentRefunds",
      CASE WHEN snap.breakdown ? 'refundsRecorded' THEN
        GREATEST(0,(b.refund_due_amount+b.extra_refund_due_amount)::bigint
          -(snap.breakdown->>'refundsRecorded')::bigint) ELSE NULL END AS "refundsAfterClose",
      COALESCE((SELECT sum(t.amount) FROM financial_transfers t
        WHERE t.obligation_id=o.id AND t.status='succeeded'),0)::bigint AS "paidToStudio"
     FROM studio_settlement_snapshots snap JOIN bookings b ON b.id=snap.booking_id
     JOIN sessions s ON s.id=snap.session_id JOIN workshops w ON w.id=s.workshop_id
     JOIN studios st ON st.id=w.studio_id
     LEFT JOIN financial_obligations o ON o.booking_id=b.id AND o.kind='studio_payout'
     ORDER BY snap.created_at DESC,snap.booking_id LIMIT 500`,
    ),
  );
  res.json({ items: result.rows });
});

obligationsRouter.post('/nghia-vu/:id/chuyen-tien', async (req, res) => {
  const id = z.uuid().parse(req.params.id);
  const input = transferInput.parse(req.body);
  const created = await withTransaction(async (client) => {
    const row = await client.query<{
      kind: string;
      amount: string;
      status: string;
      bookingId: string;
      relatedId: string | null;
    }>(
      `SELECT kind,amount::text,status,booking_id AS "bookingId",related_obligation_id AS "relatedId"
       FROM financial_obligations WHERE id=$1 FOR UPDATE`,
      [id],
    );
    const obligation = row.rows[0];
    if (
      !obligation ||
      ['paid', 'cancelled', 'manual_review'].includes(obligation.status)
    )
      throw new AppError(
        409,
        'CONFLICT',
        'Nghĩa vụ này không còn nhận giao dịch.',
      );
    const direction =
      obligation.kind === 'studio_recovery' ? 'inbound' : 'outbound';
    const purpose =
      input.purpose ??
      (direction === 'inbound'
        ? 'studio_repayment'
        : obligation.kind === 'studio_payout'
          ? 'studio_payout'
          : 'customer_refund');
    const purposeAllowed =
      obligation.kind === 'studio_recovery'
        ? purpose === 'studio_repayment'
        : obligation.kind === 'studio_payout'
          ? purpose === 'studio_payout'
          : purpose === 'customer_refund' || purpose === 'platform_advance';
    if (!purposeAllowed)
      throw new AppError(
        422,
        'UNPROCESSABLE_ENTITY',
        'Loại giao dịch không khớp khoản cần xử lý.',
      );
    const duplicate = await client.query(
      `SELECT 1 FROM financial_transfers WHERE idempotency_key=$1`,
      [input.idempotencyKey],
    );
    if (duplicate.rowCount)
      throw new AppError(
        409,
        'CONFLICT',
        'Mã yêu cầu này đã được ghi nhận. Hãy kiểm tra giao dịch trước khi thử lại.',
      );
    const sum = await client.query<{ settled: string; reserved: string }>(
      `SELECT COALESCE(sum(amount) FILTER (WHERE status='succeeded'),0)::text AS settled,
        COALESCE(sum(amount) FILTER (WHERE status <> 'failed'),0)::text AS reserved
       FROM financial_transfers WHERE obligation_id=$1 AND direction=$2`,
      [id, direction],
    );
    const remaining = BigInt(obligation.amount) - BigInt(sum.rows[0]!.reserved);
    if (BigInt(input.amount) > remaining)
      throw new AppError(
        409,
        'CONFLICT',
        'Số tiền vượt quá khoản còn phải xử lý.',
      );
    if (obligation.kind === 'customer_refund') {
      const funding = await client.query<{
        funded: string;
        platformDepositAvailable: string;
      }>(
        `SELECT
           COALESCE((SELECT sum(t.amount) FROM financial_transfers t WHERE t.obligation_id=$1 AND t.direction='inbound' AND t.status='succeeded'),0)::text AS funded,
           CASE WHEN EXISTS(SELECT 1 FROM studio_settlement_snapshots snap WHERE snap.booking_id=$2) THEN '0'
                ELSE GREATEST(
                  0,
                  COALESCE((SELECT sum(p.amount) FROM payments p WHERE p.booking_id=$2 AND p.kind='deposit' AND p.status='paid'),0)
                  - COALESCE((SELECT sum(ft.amount) FROM financial_transfers ft JOIN financial_obligations fo ON fo.id=ft.obligation_id WHERE fo.booking_id=$2 AND fo.kind='customer_refund' AND fo.id<>$3 AND ft.direction='outbound' AND ft.purpose='customer_refund' AND ft.status<>'failed'),0)
                )::text
           END AS "platformDepositAvailable"`,
        [obligation.relatedId, obligation.bookingId, id],
      );
      const payouts = await client.query<{ reserved: string }>(
        `SELECT COALESCE(sum(amount),0)::text AS reserved FROM financial_transfers WHERE obligation_id=$1 AND direction='outbound' AND purpose IN ('customer_refund','platform_advance') AND status<>'failed'`,
        [id],
      );
      const availableForCustomerRefund =
        BigInt(funding.rows[0]!.funded) +
        BigInt(funding.rows[0]!.platformDepositAvailable);
      if (
        purpose === 'customer_refund' &&
        availableForCustomerRefund - BigInt(payouts.rows[0]!.reserved) <
          BigInt(input.amount)
      )
        throw new AppError(
          409,
          'CONFLICT',
          'Studio chưa hoàn đủ tiền về Open Slot cho khoản này.',
        );
      if (purpose === 'platform_advance') {
        const advances = await client.query<{ reserved: string }>(
          `SELECT COALESCE(sum(amount),0)::text AS reserved FROM financial_transfers WHERE obligation_id=$1 AND purpose='platform_advance' AND status<>'failed'`,
          [id],
        );
        if (
          BigInt(obligation.amount) -
            BigInt(funding.rows[0]!.funded) -
            BigInt(advances.rows[0]!.reserved) <
          BigInt(input.amount)
        )
          throw new AppError(
            409,
            'CONFLICT',
            'Khoản tạm ứng vượt phần studio chưa hoàn về.',
          );
      }
    }
    const status = 'pending_approval';
    const inserted = await client.query<{ id: string }>(
      `INSERT INTO financial_transfers(obligation_id,direction,purpose,amount,provider_fee,provider,reference,idempotency_key,status,created_by)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
      [
        id,
        direction,
        purpose,
        input.amount,
        null,
        input.provider ?? null,
        input.reference ?? null,
        input.idempotencyKey,
        status,
        req.user!.sub,
      ],
    );
    const tid = inserted.rows[0]!.id;
    await client.query(
      `INSERT INTO financial_transfer_events(transfer_id,actor_id,event,details) VALUES($1,$2,'created',$3::jsonb)`,
      [
        tid,
        req.user!.sub,
        JSON.stringify({
          direction,
          purpose,
          amount: input.amount,
          reason: input.reason,
          reference: input.reference ?? null,
        }),
      ],
    );
    await client.query(
      `UPDATE financial_obligations SET status=$2,updated_at=clock_timestamp() WHERE id=$1`,
      [id, 'awaiting_approval'],
    );
    await writeAuditLog(client, {
      actorId: req.user!.sub,
      action: 'financial.transfer.created',
      targetType: 'booking',
      targetId: obligation.bookingId,
      targetName: 'Giao dịch tài chính',
      reason: input.reason,
      after: { transferId: tid, direction, amount: input.amount, status },
    });
    return { id: tid, status };
  });
  res.status(201).json(created);
});

obligationsRouter.get('/nghia-vu/:id/vietqr', async (req, res) => {
  const id = z.uuid().parse(req.params.id);
  const payload = await withTransaction(async (client) => {
    const obRes = await client.query<{
      id: string;
      kind: string;
      bookingId: string;
      orderCode: string;
      studioId: string;
      studioName: string;
      amount: string;
      status: string;
      settledAmount: string;
    }>(
      `SELECT o.id, o.kind, o.booking_id AS "bookingId", b.order_code::text AS "orderCode",
              o.studio_id AS "studioId", st.name AS "studioName", o.amount::text AS amount, o.status,
              COALESCE((SELECT sum(t.amount) FROM financial_transfers t WHERE t.obligation_id=o.id AND t.direction='outbound' AND t.status='succeeded'),0)::text AS "settledAmount"
       FROM financial_obligations o
       JOIN bookings b ON b.id=o.booking_id
       JOIN studios st ON st.id=o.studio_id
       WHERE o.id=$1`,
      [id],
    );
    const obligation = obRes.rows[0];
    if (!obligation) {
      throw new AppError(
        404,
        'NOT_FOUND',
        'Không tìm thấy nghĩa vụ tài chính.',
      );
    }
    if (!['customer_refund', 'studio_payout'].includes(obligation.kind)) {
      throw new AppError(
        422,
        'UNPROCESSABLE_ENTITY',
        'Chỉ hỗ trợ tạo mã VietQR cho khoản hoàn khách hoặc chi trả studio.',
      );
    }
    const remaining =
      BigInt(obligation.amount) - BigInt(obligation.settledAmount);
    if (remaining <= 0n || ['paid', 'cancelled'].includes(obligation.status)) {
      throw new AppError(
        409,
        'CONFLICT',
        'Khoản nghĩa vụ này đã được xử lý xong.',
      );
    }

    type AccountRow = {
      id: string;
      bankName: string | null;
      bankBin: string | null;
      accountHolder: string;
      last4: string;
      status: string;
      encryptedNumber: Buffer;
      iv: Buffer;
      tag: Buffer;
    };
    let acc: AccountRow | undefined;
    if (obligation.kind === 'studio_payout') {
      const r = await client.query<AccountRow>(
        `SELECT id, bank_name AS "bankName", bank_bin AS "bankBin", account_holder AS "accountHolder",
                account_last4 AS last4, status, encrypted_number AS "encryptedNumber",
                encryption_iv AS iv, encryption_tag AS tag
         FROM studio_payout_accounts
         WHERE studio_id=$1 AND is_current AND status IN ('pending','verified')`,
        [obligation.studioId],
      );
      acc = r.rows[0];
    } else {
      const r = await client.query<AccountRow>(
        `SELECT id, bank_name AS "bankName", bank_bin AS "bankBin", account_holder AS "accountHolder",
                account_last4 AS last4, status, encrypted_number AS "encryptedNumber",
                encryption_iv AS iv, encryption_tag AS tag
         FROM customer_refund_accounts
         WHERE refund_id=$1 AND is_current AND status IN ('pending','verified') AND purged_at IS NULL`,
        [obligation.id],
      );
      acc = r.rows[0];
    }
    if (!acc) {
      throw new AppError(
        409,
        'CONFLICT',
        obligation.kind === 'studio_payout'
          ? 'Studio chưa bổ sung tài khoản ngân hàng nhận chi trả.'
          : 'Khách hàng chưa bổ sung tài khoản ngân hàng nhận hoàn tiền.',
      );
    }

    const accountNumber = decryptFinancialAccount(
      acc.encryptedNumber,
      acc.iv,
      acc.tag,
    );
    await writeAuditLog(client, {
      actorId: req.user!.sub,
      action:
        obligation.kind === 'studio_payout'
          ? 'financial.studio_account.full_viewed'
          : 'financial.customer_account.full_viewed',
      targetType: obligation.kind === 'studio_payout' ? 'studio' : 'booking',
      targetId:
        obligation.kind === 'studio_payout'
          ? obligation.studioId
          : obligation.bookingId,
      targetName:
        obligation.kind === 'studio_payout'
          ? 'Xem số tài khoản nhận tiền qua VietQR'
          : 'Xem số tài khoản nhận hoàn qua VietQR',
      after: {
        obligationId: obligation.id,
        accountId: acc.id,
        last4: acc.last4,
      },
    });

    const transferContent =
      obligation.kind === 'customer_refund'
        ? `OS HOAN ${obligation.orderCode}`
        : `OS CHI ${obligation.orderCode}`;
    const bankDisplay = formatBankDisplay(acc.bankBin, acc.bankName);
    const cleanBin = acc.bankBin?.trim() ?? '';
    const vietqrUrl = /^\d{6}$/.test(cleanBin)
      ? `https://img.vietqr.io/image/${cleanBin}-${encodeURIComponent(accountNumber.trim())}-compact2.png?amount=${remaining.toString()}&addInfo=${encodeURIComponent(transferContent)}&accountName=${encodeURIComponent(acc.accountHolder)}`
      : null;

    return {
      obligationId: obligation.id,
      kind: obligation.kind,
      bookingId: obligation.bookingId,
      orderCode: obligation.orderCode,
      studioName: obligation.studioName,
      amount: Number(remaining),
      accountId: acc.id,
      accountStatus: acc.status,
      bankBin: acc.bankBin,
      bankName: acc.bankName,
      bankDisplay,
      accountHolder: acc.accountHolder,
      accountNumber,
      last4: acc.last4,
      transferContent,
      vietqrUrl,
    };
  });

  res.setHeader('Cache-Control', 'no-store');
  res.json(payload);
});

const quickVietqrSettlementInput = z
  .object({
    amount: z.number().int().positive().optional(),
    reference: z.string().trim().min(3).max(200),
    provider: z.string().trim().min(2).max(80).default('VietQR Napas 247'),
    providerFee: z.number().int().nonnegative().default(0),
    idempotencyKey: z.string().trim().min(8).max(120),
    reason: z
      .string()
      .trim()
      .min(10)
      .max(500)
      .default('Quản trị quét mã VietQR chuyển khoản và xác nhận hoàn tất.'),
  })
  .strict();

obligationsRouter.post(
  '/nghia-vu/:id/chuyen-nhanh-vietqr',
  async (req, res) => {
    const id = z.uuid().parse(req.params.id);
    const input = quickVietqrSettlementInput.parse(req.body);
    const refundNotice: {
      value?: { bookingId: string; amount: string; reference?: string };
    } = {};

    const settled = await withTransaction(async (client) => {
      const obRes = await client.query<{
        kind: string;
        amount: string;
        status: string;
        bookingId: string;
        studioId: string;
        relatedId: string | null;
      }>(
        `SELECT kind, amount::text, status, booking_id AS "bookingId", studio_id AS "studioId", related_obligation_id AS "relatedId"
         FROM financial_obligations WHERE id=$1 FOR UPDATE`,
        [id],
      );
      const obligation = obRes.rows[0];
      if (
        !obligation ||
        ['paid', 'cancelled', 'manual_review'].includes(obligation.status)
      ) {
        throw new AppError(
          409,
          'CONFLICT',
          'Nghĩa vụ này không còn nhận giao dịch.',
        );
      }
      if (!['customer_refund', 'studio_payout'].includes(obligation.kind)) {
        throw new AppError(
          422,
          'UNPROCESSABLE_ENTITY',
          'Chỉ hỗ trợ xác nhận nhanh VietQR cho khoản hoàn khách hoặc chi trả studio.',
        );
      }

      const duplicate = await client.query(
        `SELECT 1 FROM financial_transfers WHERE idempotency_key=$1`,
        [input.idempotencyKey],
      );
      if (duplicate.rowCount) {
        throw new AppError(
          409,
          'CONFLICT',
          'Mã yêu cầu này đã được ghi nhận. Hãy kiểm tra giao dịch trước khi thử lại.',
        );
      }

      let destinationStudioAccountId: string | null = null;
      let destinationCustomerAccountId: string | null = null;

      if (obligation.kind === 'studio_payout') {
        const accRes = await client.query<{
          id: string;
          status: string;
          last4: string;
        }>(
          `SELECT id, status, account_last4 AS last4
           FROM studio_payout_accounts
           WHERE studio_id=$1 AND is_current AND status IN ('pending','verified') FOR UPDATE`,
          [obligation.studioId],
        );
        const acc = accRes.rows[0];
        if (!acc) {
          throw new AppError(
            409,
            'CONFLICT',
            'Studio chưa có tài khoản nhận tiền.',
          );
        }
        if (acc.status === 'pending') {
          await client.query(
            `UPDATE studio_payout_accounts
             SET status='verified', verified_by=$2, verified_at=clock_timestamp(), verification_reference=$3
             WHERE id=$1`,
            [acc.id, req.user!.sub, input.reference],
          );
          await writeAuditLog(client, {
            actorId: req.user!.sub,
            action: 'financial.studio_account.verified',
            targetType: 'studio',
            targetId: obligation.studioId,
            targetName: 'Xác minh tài khoản nhận tiền khi chuyển khoản VietQR',
            reason: input.reason,
            after: {
              accountId: acc.id,
              last4: acc.last4,
              decision: 'verified',
              verificationReference: input.reference,
            },
          });
        }
        destinationStudioAccountId = acc.id;
      } else {
        const accRes = await client.query<{
          id: string;
          status: string;
          last4: string;
        }>(
          `SELECT id, status, account_last4 AS last4
           FROM customer_refund_accounts
           WHERE refund_id=$1 AND is_current AND status IN ('pending','verified') AND purged_at IS NULL FOR UPDATE`,
          [id],
        );
        const acc = accRes.rows[0];
        if (!acc) {
          throw new AppError(
            409,
            'CONFLICT',
            'Khách hàng chưa có tài khoản nhận hoàn.',
          );
        }
        if (acc.status === 'pending') {
          await client.query(
            `UPDATE customer_refund_accounts
             SET status='verified', verified_by=$2, verified_at=clock_timestamp(), verification_reference=$3
             WHERE id=$1`,
            [acc.id, req.user!.sub, input.reference],
          );
          await writeAuditLog(client, {
            actorId: req.user!.sub,
            action: 'financial.customer_account.verified',
            targetType: 'booking',
            targetId: obligation.bookingId,
            targetName: 'Xác minh tài khoản nhận hoàn khi chuyển khoản VietQR',
            reason: input.reason,
            after: {
              refundId: id,
              accountId: acc.id,
              last4: acc.last4,
              decision: 'verified',
              verificationReference: input.reference,
            },
          });
        }
        destinationCustomerAccountId = acc.id;
      }

      const totalsRes = await client.query<{
        settled: string;
        reserved: string;
      }>(
        `SELECT COALESCE(sum(amount) FILTER (WHERE status='succeeded'),0)::text AS settled,
                COALESCE(sum(amount) FILTER (WHERE status <> 'failed'),0)::text AS reserved
         FROM financial_transfers WHERE obligation_id=$1 AND direction='outbound'`,
        [id],
      );
      const settledSoFar = BigInt(totalsRes.rows[0]!.settled);
      const reservedSoFar = BigInt(totalsRes.rows[0]!.reserved);
      const remainingUnsettled = BigInt(obligation.amount) - settledSoFar;
      const targetAmount =
        input.amount !== undefined ? BigInt(input.amount) : remainingUnsettled;

      if (targetAmount <= 0n || targetAmount > remainingUnsettled) {
        throw new AppError(
          409,
          'CONFLICT',
          'Số tiền vượt quá khoản còn phải xử lý.',
        );
      }

      const reusable = await client.query<{ id: string; status: string }>(
        `SELECT id, status FROM financial_transfers
         WHERE obligation_id=$1 AND direction='outbound'
           AND status IN ('pending_approval','approved')
           AND amount=$2
         ORDER BY created_at DESC LIMIT 1 FOR UPDATE`,
        [id, targetAmount.toString()],
      );

      let transferId: string;
      if (reusable.rows[0]) {
        transferId = reusable.rows[0].id;
        await client.query(
          `UPDATE financial_transfers
           SET status='approved',
               approved_by=COALESCE(approved_by,$2::uuid),
               approved_at=COALESCE(approved_at,clock_timestamp()),
               destination_studio_account_id=COALESCE($3::uuid,destination_studio_account_id),
               destination_customer_account_id=COALESCE($4::uuid,destination_customer_account_id)
           WHERE id=$1`,
          [
            transferId,
            req.user!.sub,
            destinationStudioAccountId,
            destinationCustomerAccountId,
          ],
        );
        if (reusable.rows[0].status === 'pending_approval') {
          await client.query(
            `INSERT INTO financial_transfer_events(transfer_id,actor_id,event,details)
             VALUES($1,$2,'approved',$3::jsonb)`,
            [
              transferId,
              req.user!.sub,
              JSON.stringify({ reason: input.reason }),
            ],
          );
        }
      } else {
        if (targetAmount > BigInt(obligation.amount) - reservedSoFar) {
          throw new AppError(
            409,
            'CONFLICT',
            'Khoản này đã có giao dịch đang chờ xử lý. Hãy kiểm tra tab Giao dịch.',
          );
        }
        let purpose =
          obligation.kind === 'studio_payout'
            ? 'studio_payout'
            : 'customer_refund';
        if (obligation.kind === 'customer_refund') {
          const funding = await client.query<{
            funded: string;
            platformDepositAvailable: string;
          }>(
            `SELECT
               COALESCE((SELECT sum(t.amount) FROM financial_transfers t WHERE t.obligation_id=$1 AND t.direction='inbound' AND t.status='succeeded'),0)::text AS funded,
               CASE WHEN EXISTS(SELECT 1 FROM studio_settlement_snapshots snap WHERE snap.booking_id=$2) THEN '0'
                    ELSE GREATEST(
                      0,
                      COALESCE((SELECT sum(p.amount) FROM payments p WHERE p.booking_id=$2 AND p.kind='deposit' AND p.status='paid'),0)
                      - COALESCE((SELECT sum(ft.amount) FROM financial_transfers ft JOIN financial_obligations fo ON fo.id=ft.obligation_id WHERE fo.booking_id=$2 AND fo.kind='customer_refund' AND fo.id<>$3 AND ft.direction='outbound' AND ft.purpose='customer_refund' AND ft.status<>'failed'),0)
                    )::text
               END AS "platformDepositAvailable"`,
            [obligation.relatedId, obligation.bookingId, id],
          );
          const availableForCustomerRefund =
            BigInt(funding.rows[0]!.funded) +
            BigInt(funding.rows[0]!.platformDepositAvailable);
          if (availableForCustomerRefund - reservedSoFar < targetAmount) {
            purpose = 'platform_advance';
          }
        }
        const inserted = await client.query<{ id: string }>(
          `INSERT INTO financial_transfers(
             obligation_id,direction,purpose,amount,provider_fee,provider,reference,
             idempotency_key,status,created_by,approved_by,approved_at,
             destination_studio_account_id,destination_customer_account_id
           )
           VALUES($1,'outbound',$2,$3,$4,$5,$6,$7,'approved',$8,$8,clock_timestamp(),$9,$10)
           RETURNING id`,
          [
            id,
            purpose,
            targetAmount.toString(),
            input.providerFee,
            input.provider,
            input.reference,
            input.idempotencyKey,
            req.user!.sub,
            destinationStudioAccountId,
            destinationCustomerAccountId,
          ],
        );
        transferId = inserted.rows[0]!.id;
        await client.query(
          `INSERT INTO financial_transfer_events(transfer_id,actor_id,event,details)
           VALUES
             ($1,$2,'created',$3::jsonb),
             ($1,$2,'approved',$4::jsonb)`,
          [
            transferId,
            req.user!.sub,
            JSON.stringify({
              direction: 'outbound',
              purpose,
              amount: Number(targetAmount),
              reason: input.reason,
              reference: input.reference,
            }),
            JSON.stringify({ reason: input.reason }),
          ],
        );
      }

      await processTransferResult(
        client,
        transferId,
        req.user!.sub,
        {
          result: 'succeeded',
          reference: input.reference,
          provider: input.provider,
          providerFee: input.providerFee,
          reason: input.reason,
        },
        refundNotice,
      );

      return {
        ok: true,
        transferId,
        status: 'succeeded' as const,
        reference: input.reference,
      };
    });

    if (refundNotice.value) {
      queueRefundEmail(
        refundNotice.value.bookingId,
        settled.transferId,
        refundNotice.value.amount,
        refundNotice.value.reference,
      );
    }

    res.json(settled);
  },
);
