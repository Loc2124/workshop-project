import { Router } from 'express';
import * as argon2 from 'argon2';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth.js';
import { createApiRateLimiter } from '../../middleware/rate-limits.js';
import { validateUuidParam } from '../../middleware/validate-uuid-param.js';
import { query, withTransaction } from '../../db/pool.js';
import { AppError } from '../../errors/app-error.js';
import {
  encryptFinancialAccount,
  financialAccountEncryptionAvailable,
} from '../payments/financial-account-crypto.js';
import { writeAuditLog } from '../admin/audit-log.js';

export const refundAccountsRouter = Router();
refundAccountsRouter.use('/me/refund-accounts', requireAuth());
refundAccountsRouter.use(
  '/bookings/:bookingId/refund-destinations',
  requireAuth(),
);
refundAccountsRouter.use('/refunds/:refundId/account', requireAuth());

refundAccountsRouter.get('/me/refund-accounts', async (req, res) => {
  const result = await query(
    `SELECT id,bank_bin AS "bankBin",account_holder AS "accountHolder",
      account_last4 AS last4,created_at AS "createdAt"
     FROM customer_saved_refund_accounts WHERE user_id=$1 AND deleted_at IS NULL
     ORDER BY created_at DESC LIMIT 20`,
    [req.user!.sub],
  );
  res.setHeader('Cache-Control', 'no-store');
  res.json({ items: result.rows });
});

refundAccountsRouter.delete(
  '/me/refund-accounts/:id',
  validateUuidParam('id'),
  async (req, res) => {
    const id = String(req.params.id);
    await withTransaction(async (client) => {
      const result = await client.query<{ last4: string }>(
        `UPDATE customer_saved_refund_accounts
       SET bank_bin=NULL,account_holder=NULL,encrypted_number=NULL,encryption_iv=NULL,
         encryption_tag=NULL,deleted_at=clock_timestamp()
       WHERE id=$1 AND user_id=$2 AND deleted_at IS NULL
       RETURNING account_last4 AS last4`,
        [id, req.user!.sub],
      );
      if (!result.rows[0])
        throw new AppError(
          404,
          'NOT_FOUND',
          'Không tìm thấy tài khoản đã lưu.',
        );
      await writeAuditLog(client, {
        actorId: req.user!.sub,
        action: 'refund.saved_account.deleted',
        targetType: 'user',
        targetId: req.user!.sub,
        targetName: 'Xóa tài khoản nhận hoàn đã lưu',
        after: { accountId: id, last4: result.rows[0].last4 },
      });
    });
    res.json({ ok: true });
  },
);

refundAccountsRouter.get(
  '/bookings/:bookingId/refund-destinations',
  validateUuidParam('bookingId'),
  async (req, res) => {
    const bookingId = String(req.params.bookingId);
    const owner = await query(
      `SELECT 1 FROM bookings WHERE id=$1 AND user_id=$2`,
      [bookingId, req.user!.sub],
    );
    if (!owner.rowCount)
      throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy đặt chỗ.');
    const result = await query(
      `SELECT o.id AS "refundId",o.amount,o.reason,o.status,a.status AS "accountStatus",
      a.account_last4 AS "accountLast4",
      (SELECT COALESCE(sum(t.amount),0)::bigint FROM financial_transfers t
        WHERE t.obligation_id=o.id AND t.direction='outbound' AND t.status='succeeded') AS "settledAmount",
      (SELECT t.status FROM financial_transfers t WHERE t.obligation_id=o.id
        ORDER BY t.created_at DESC,t.id DESC LIMIT 1) AS "transferStatus"
     FROM financial_obligations o LEFT JOIN customer_refund_accounts a
       ON a.refund_id=o.id AND a.is_current AND a.purged_at IS NULL
     WHERE o.booking_id=$1 AND o.kind='customer_refund' AND o.status<>'cancelled'
     ORDER BY o.created_at,o.id`,
      [bookingId],
    );
    res.setHeader('Cache-Control', 'no-store');
    res.json({ items: result.rows });
  },
);

refundAccountsRouter.get(
  '/refunds/:refundId/account',
  validateUuidParam('refundId'),
  async (req, res) => {
    const refundId = String(req.params.refundId);
    const owner = await query(
      `SELECT 1 FROM financial_obligations o JOIN bookings b ON b.id=o.booking_id
     WHERE o.id=$1 AND o.kind='customer_refund' AND b.user_id=$2`,
      [refundId, req.user!.sub],
    );
    if (!owner.rowCount)
      throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy khoản hoàn.');
    const accounts = await query(
      `SELECT id,bank_bin AS "bankBin",account_holder AS "accountHolder",account_last4 AS last4,
      source,status,is_current AS "isCurrent",created_at AS "createdAt",verified_at AS "verifiedAt"
     FROM customer_refund_accounts WHERE refund_id=$1 ORDER BY created_at DESC LIMIT 20`,
      [refundId],
    );
    res.setHeader('Cache-Control', 'no-store');
    res.json({
      enabled: financialAccountEncryptionAvailable(),
      items: accounts.rows,
    });
  },
);

refundAccountsRouter.put(
  '/refunds/:refundId/account',
  validateUuidParam('refundId'),
  createApiRateLimiter({ limit: 5, windowMs: 15 * 60_000 }),
  async (req, res) => {
    const input = z
      .object({
        bankBin: z.string().regex(/^[0-9]{6}$/),
        accountHolder: z.string().trim().min(2).max(160),
        accountNumber: z.string().regex(/^[0-9]{4,30}$/),
        password: z.string().min(1).max(200),
        saveForLater: z.boolean().default(false),
      })
      .strict()
      .parse(req.body);
    const refundId = String(req.params.refundId);
    const encrypted = encryptFinancialAccount(input.accountNumber);
    const saved = await withTransaction(async (client) => {
      const row = await client.query<{
        bookingId: string;
        passwordHash: string;
      }>(
        `SELECT b.id AS "bookingId",u.password_hash AS "passwordHash"
       FROM financial_obligations o JOIN bookings b ON b.id=o.booking_id JOIN users u ON u.id=b.user_id
       WHERE o.id=$1 AND o.kind='customer_refund' AND o.status NOT IN ('paid','cancelled')
         AND u.id=$2 AND NOT u.is_blocked FOR UPDATE OF o,b`,
        [refundId, req.user!.sub],
      );
      if (!row.rows[0])
        throw new AppError(
          409,
          'CONFLICT',
          'Khoản hoàn này không còn chờ tài khoản nhận tiền.',
        );
      const inFlight = await client.query(
        `SELECT 1 FROM financial_transfers WHERE obligation_id=$1 AND status IN ('approved','processing','manual_review') LIMIT 1`,
        [refundId],
      );
      if (inFlight.rowCount)
        throw new AppError(
          409,
          'CONFLICT',
          'Khoản hoàn đang được chuyển hoặc đối chiếu. Vui lòng đợi kết quả trước khi đổi tài khoản.',
        );
      if (!(await argon2.verify(row.rows[0].passwordHash, input.password)))
        throw new AppError(
          401,
          'UNAUTHORIZED',
          'Mật khẩu chưa đúng. Vui lòng thử lại.',
        );
      const previous = await client.query<{ id: string; last4: string }>(
        `UPDATE customer_refund_accounts SET is_current=false WHERE refund_id=$1 AND is_current
       RETURNING id,account_last4 AS last4`,
        [refundId],
      );
      await client.query(
        `UPDATE customer_refund_accounts a SET encrypted_number=NULL,encryption_iv=NULL,encryption_tag=NULL,
         bank_name=NULL,bank_bin=NULL,account_holder=NULL,purged_at=clock_timestamp()
       WHERE a.refund_id=$1 AND NOT a.is_current AND a.purged_at IS NULL
         AND NOT EXISTS(SELECT 1 FROM financial_transfers t WHERE t.destination_customer_account_id=a.id)`,
        [refundId],
      );
      const result = await client.query<{ id: string }>(
        `INSERT INTO customer_refund_accounts(booking_id,user_id,refund_id,bank_bin,source,account_holder,
         account_last4,encrypted_number,encryption_iv,encryption_tag)
       VALUES($1,$2,$3,$4,'customer_input',$5,$6,$7,$8,$9) RETURNING id`,
        [
          row.rows[0].bookingId,
          req.user!.sub,
          refundId,
          input.bankBin,
          input.accountHolder,
          input.accountNumber.slice(-4),
          encrypted.encrypted,
          encrypted.iv,
          encrypted.tag,
        ],
      );
      let savedAccountId: string | null = null;
      if (input.saveForLater) {
        await client.query(`SELECT id FROM users WHERE id=$1 FOR UPDATE`, [
          req.user!.sub,
        ]);
        const count = await client.query<{ total: number }>(
          `SELECT count(*)::int AS total FROM customer_saved_refund_accounts WHERE user_id=$1 AND deleted_at IS NULL`,
          [req.user!.sub],
        );
        if ((count.rows[0]?.total ?? 0) >= 10)
          throw new AppError(
            409,
            'CONFLICT',
            'Bạn đã lưu tối đa 10 tài khoản. Vui lòng xóa bớt trước khi lưu thêm.',
          );
        const savedEncryption = encryptFinancialAccount(input.accountNumber);
        const reusable = await client.query<{ id: string }>(
          `INSERT INTO customer_saved_refund_accounts(user_id,bank_bin,account_holder,account_last4,
           encrypted_number,encryption_iv,encryption_tag)
         VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
          [
            req.user!.sub,
            input.bankBin,
            input.accountHolder,
            input.accountNumber.slice(-4),
            savedEncryption.encrypted,
            savedEncryption.iv,
            savedEncryption.tag,
          ],
        );
        savedAccountId = reusable.rows[0]!.id;
      }
      await writeAuditLog(client, {
        actorId: req.user!.sub,
        action: 'refund.destination.changed',
        targetType: 'booking',
        targetId: row.rows[0].bookingId,
        targetName: 'Tài khoản nhận hoàn',
        before: {
          refundId,
          accountId: previous.rows[0]?.id ?? null,
          last4: previous.rows[0]?.last4 ?? null,
        },
        after: {
          refundId,
          accountId: result.rows[0]!.id,
          bankBin: input.bankBin,
          last4: input.accountNumber.slice(-4),
          status: 'pending',
          savedForLater: input.saveForLater,
          savedAccountId,
        },
      });
      return {
        id: result.rows[0]!.id,
        last4: input.accountNumber.slice(-4),
        status: 'pending',
        savedForLater: input.saveForLater,
      };
    });
    res.setHeader('Cache-Control', 'no-store');
    res.json(saved);
  },
);

refundAccountsRouter.post(
  '/refunds/:refundId/account/from-saved',
  validateUuidParam('refundId'),
  createApiRateLimiter({ limit: 5, windowMs: 15 * 60_000 }),
  async (req, res) => {
    const input = z
      .object({
        savedAccountId: z.uuid(),
        password: z.string().min(1).max(200),
      })
      .strict()
      .parse(req.body);
    const refundId = String(req.params.refundId);
    const result = await withTransaction(async (client) => {
      const refund = await client.query<{
        bookingId: string;
        passwordHash: string;
      }>(
        `SELECT b.id AS "bookingId",u.password_hash AS "passwordHash"
       FROM financial_obligations o JOIN bookings b ON b.id=o.booking_id JOIN users u ON u.id=b.user_id
       WHERE o.id=$1 AND o.kind='customer_refund' AND o.status NOT IN ('paid','cancelled')
         AND u.id=$2 AND NOT u.is_blocked FOR UPDATE OF o,b`,
        [refundId, req.user!.sub],
      );
      if (!refund.rows[0])
        throw new AppError(
          409,
          'CONFLICT',
          'Khoản hoàn này không còn chờ tài khoản nhận tiền.',
        );
      const inFlight = await client.query(
        `SELECT 1 FROM financial_transfers WHERE obligation_id=$1 AND status IN ('approved','processing','manual_review') LIMIT 1`,
        [refundId],
      );
      if (inFlight.rowCount)
        throw new AppError(
          409,
          'CONFLICT',
          'Khoản hoàn đang được chuyển hoặc đối chiếu. Vui lòng đợi kết quả trước khi đổi tài khoản.',
        );
      if (!(await argon2.verify(refund.rows[0].passwordHash, input.password)))
        throw new AppError(
          401,
          'UNAUTHORIZED',
          'Mật khẩu chưa đúng. Vui lòng thử lại.',
        );
      const saved = await client.query<{ last4: string }>(
        `SELECT account_last4 AS last4 FROM customer_saved_refund_accounts
       WHERE id=$1 AND user_id=$2 AND deleted_at IS NULL FOR SHARE`,
        [input.savedAccountId, req.user!.sub],
      );
      if (!saved.rows[0])
        throw new AppError(
          404,
          'NOT_FOUND',
          'Tài khoản đã lưu không còn khả dụng.',
        );
      await client.query(
        `UPDATE customer_refund_accounts SET is_current=false WHERE refund_id=$1 AND is_current`,
        [refundId],
      );
      await client.query(
        `UPDATE customer_refund_accounts a SET encrypted_number=NULL,encryption_iv=NULL,encryption_tag=NULL,
         bank_name=NULL,bank_bin=NULL,account_holder=NULL,purged_at=clock_timestamp()
       WHERE a.refund_id=$1 AND NOT a.is_current AND a.purged_at IS NULL
         AND NOT EXISTS(SELECT 1 FROM financial_transfers t WHERE t.destination_customer_account_id=a.id)`,
        [refundId],
      );
      const inserted = await client.query<{ id: string }>(
        `INSERT INTO customer_refund_accounts(booking_id,user_id,refund_id,bank_bin,source,saved_account_id,
         account_holder,account_last4,encrypted_number,encryption_iv,encryption_tag)
       SELECT $1,$2,$3,s.bank_bin,'saved_account',s.id,s.account_holder,s.account_last4,
         s.encrypted_number,s.encryption_iv,s.encryption_tag
       FROM customer_saved_refund_accounts s WHERE s.id=$4 AND s.user_id=$2 AND s.deleted_at IS NULL
       RETURNING id`,
        [
          refund.rows[0].bookingId,
          req.user!.sub,
          refundId,
          input.savedAccountId,
        ],
      );
      if (!inserted.rows[0])
        throw new AppError(
          409,
          'CONFLICT',
          'Tài khoản đã lưu không còn khả dụng.',
        );
      await writeAuditLog(client, {
        actorId: req.user!.sub,
        action: 'refund.saved_account.used',
        targetType: 'booking',
        targetId: refund.rows[0].bookingId,
        targetName: 'Dùng tài khoản đã lưu để nhận hoàn',
        after: {
          refundId,
          savedAccountId: input.savedAccountId,
          accountId: inserted.rows[0].id,
          last4: saved.rows[0].last4,
        },
      });
      return {
        id: inserted.rows[0].id,
        last4: saved.rows[0].last4,
        status: 'pending',
      };
    });
    res.setHeader('Cache-Control', 'no-store');
    res.json(result);
  },
);
